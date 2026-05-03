import { Injectable, ComponentRef, Injector, ViewContainerRef, ComponentFactoryResolver } from '@angular/core'
import { Subscription } from 'rxjs'
import { ConfigService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { MatchingService, MatchResult } from '../services/matching.service'
import { ScoringService } from '../services/scoring.service'
import { ShellDetectorService } from '../services/shell-detector.service'
import { HistoryService } from '../services/history.service'
import { DropdownComponent } from '../components/dropdown.component'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

@Injectable()
export class CommandTipsTerminalDecorator extends TerminalDecorator {
  private subscriptions: Subscription[] = []
  private currentInput = ''
  private dropdownRef: ComponentRef<DropdownComponent> | null = null
  private dropdownVisible = false
  private config: CommandTipsConfig = DEFAULT_CONFIG
  private currentProfileId = ''
  private currentShellType = 'bash'
  private matchDebounceTimer: any = null

  constructor (
    private matchingService: MatchingService,
    private scoringService: ScoringService,
    private shellDetector: ShellDetectorService,
    private historyService: HistoryService,
    private configService: ConfigService,
    private injector: Injector,
    private cfr: ComponentFactoryResolver,
  ) {
    super()
    this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    this.configService.changed$.subscribe(() => {
      this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    })
  }

  attach (tab: BaseTerminalTabComponent): void {
    this.createDropdown(tab)

    const sessionSub = tab.sessionChanged$.subscribe(session => {
      if (!session) return
      this.onSessionChanged(tab, session)
    })
    this.subscriptions.push(sessionSub)

    if (tab.session) {
      this.onSessionChanged(tab, tab.session)
    }
  }

  private createDropdown (tab: BaseTerminalTabComponent): void {
    const viewContainer: ViewContainerRef | undefined = (tab as any).viewContainer
    if (!viewContainer) return

    const factory = this.cfr.resolveComponentFactory(DropdownComponent)
    this.dropdownRef = viewContainer.createComponent(factory)

    this.dropdownRef.instance.selected.subscribe((command: string) => {
      this.injectCommand(tab.session, command)
    })
    this.dropdownRef.instance.cancelled.subscribe(() => {
      this.hideDropdown()
    })
    this.dropdownRef.instance.tabPressed.subscribe(() => {
      if (this.dropdownRef && this.dropdownRef.instance.suggestions.length > 0) {
        const firstCommand = this.dropdownRef.instance.suggestions[0].entry.command
        this.injectCommand(tab.session, firstCommand)
      }
    })

    const hostEl = (tab as any).element?.nativeElement
    if (hostEl) {
      hostEl.style.position = 'relative'
      hostEl.appendChild(this.dropdownRef.location.nativeElement)
    }
  }

  private onSessionChanged (tab: BaseTerminalTabComponent, session: any): void {
    const env = session.environment || {}
    const processName = session.processName || ''
    const shellInfo = this.shellDetector.detect(env, processName)
    this.currentShellType = shellInfo.type !== 'unknown' ? shellInfo.type : 'bash'
    this.currentProfileId = (tab as any).profile?.id || 'default'

    this.loadShellHistory(shellInfo.historyFile)

    const inputSub = tab.input$.subscribe(data => {
      this.onInput(tab, data)
    })
    this.subscriptions.push(inputSub)
  }

  private loadShellHistory (historyFile: string | null): void {
    if (!historyFile) return
    try {
      const fs = require('fs')
      const os = require('os')
      const expandedPath = historyFile.replace(/^~/, os.homedir())
      if (fs.existsSync(expandedPath)) {
        const content = fs.readFileSync(expandedPath, 'utf-8')
        const shellEntries = this.historyService.parseHistoryContent(
          content, this.currentShellType, this.currentProfileId,
        )
        const tabbyEntries = this.historyService.getTabbyEntries(this.currentProfileId)
        const merged = this.historyService.mergeEntries(shellEntries, tabbyEntries)
        this.historyService.setTabbyEntries(this.currentProfileId, merged)
      }
    } catch (err) {
      // 静默忽略
    }
  }

  private onInput (tab: BaseTerminalTabComponent, data: Buffer): void {
    const str = data.toString()

    for (const char of str) {
      if (char === '\r' || char === '\n') {
        if (this.currentInput.trim()) {
          this.historyService.recordCommand(this.currentInput.trim(), this.currentProfileId, this.currentShellType)
        }
        this.currentInput = ''
        this.hideDropdown()
      } else if (char === '\x7f') {
        this.currentInput = this.currentInput.slice(0, -1)
        if (this.currentInput.length < this.config.minChars) {
          this.hideDropdown()
        } else {
          this.triggerMatch()
        }
      } else if (char === '\x03') {
        this.currentInput = ''
        this.hideDropdown()
      } else if (char >= ' ') {
        this.currentInput += char
        this.triggerMatch()
      }
    }
  }

  private triggerMatch (): void {
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    this.matchDebounceTimer = setTimeout(() => {
      this.executeMatch()
    }, this.config.debounceMs)
  }

  private executeMatch (): void {
    if (!this.config.enabled) return
    if (this.currentInput.length < this.config.minChars) {
      this.hideDropdown()
      return
    }

    const allEntries = this.historyService.getTabbyEntries(this.currentProfileId)
    const matchResults = this.matchingService.execute(this.currentInput, allEntries, this.config.matching)

    if (matchResults.length === 0) {
      this.hideDropdown()
      return
    }

    const sortedResults = this.scoringService.sortWithLimit(
      matchResults,
      this.config.scoring,
      this.config.maxResults,
    )

    this.showDropdown(sortedResults)
  }

  private showDropdown (suggestions: MatchResult[]): void {
    if (!this.dropdownRef) return
    const instance = this.dropdownRef.instance
    instance.suggestions = suggestions
    instance.currentInput = this.currentInput
    instance.showSourceTag = this.config.showSourceTag
    instance.visible = true
    instance.ngOnChanges({ suggestions: {} } as any)
    this.dropdownVisible = true
  }

  private hideDropdown (): void {
    if (!this.dropdownRef) return
    this.dropdownRef.instance.visible = false
    this.dropdownVisible = false
  }

  private injectCommand (session: any, command: string): void {
    if (!session) return
    for (let i = 0; i < this.currentInput.length; i++) {
      session.write(Buffer.from('\x7f'))
    }
    session.write(Buffer.from(command))
    this.currentInput = command
    this.hideDropdown()
  }

  detach (tab: BaseTerminalTabComponent): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    if (this.dropdownRef) {
      this.dropdownRef.destroy()
      this.dropdownRef = null
    }
  }
}
