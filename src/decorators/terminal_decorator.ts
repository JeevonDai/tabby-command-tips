// 终端装饰器，监听终端输入并触发动态匹配、渲染下拉建议列表
import { Injectable } from '@angular/core'
import { Subscription } from 'rxjs'
import { ConfigService, Logger, LogService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'

import { MatchingService, MatchResult } from '../services/matching_service'
import { ScoringService } from '../services/scoring_service'
import { ShellDetectorService } from '../services/shell_detector_service'
import { HistoryService } from '../services/history_service'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

/** 终端装饰器，负责监听终端输入、触发动态匹配、渲染下拉建议列表 */
@Injectable()
export class CommandTipsTerminalDecorator extends TerminalDecorator {
  private readonly logger: Logger
  private subscriptions: Subscription[] = []
  private currentInput = ''
  private dropdownEl: HTMLElement | null = null
  private dropdownVisible = false
  private config: CommandTipsConfig = DEFAULT_CONFIG
  private currentProfileId = ''
  private currentShellType = 'bash'
  private matchDebounceTimer: any = null
  private selectedIndex = 0
  private currentSuggestions: MatchResult[] = []
  private attachedTab: BaseTerminalTabComponent | null = null

  constructor (
    private readonly configService: ConfigService,
    private readonly matchingService: MatchingService,
    private readonly scoringService: ScoringService,
    private readonly shellDetector: ShellDetectorService,
    private readonly historyService: HistoryService,
    private readonly log: LogService,
  ) {
    super()
    this.logger = log.create('command-tips')
    this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    this.configService.changed$.subscribe(() => {
      this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    })
    this.logger.info('Decorator constructed')
  }

  /** 将装饰器绑定到终端标签页，开始监听会话和输入事件 */
  attach (tab: BaseTerminalTabComponent): void {
    this.logger.info('attach() called')
    this.attachedTab = tab

    const sessionSub = tab.sessionChanged$.subscribe(session => {
      if (!session) return
      this.logger.info('Session changed')
      this.onSessionChanged(tab, session)
    })
    this.subscriptions.push(sessionSub)

    if (tab.session) {
      this.logger.info('Session already exists')
      this.onSessionChanged(tab, tab.session)
    }
  }

  /** 创建下拉列表的 DOM 结构（输入预览、列表容器、操作提示）并挂载到页面 */
  private createDropdown (): void {
    if (this.dropdownEl) return

    this.dropdownEl = document.createElement('div')
    this.dropdownEl.className = 'command-tips-dropdown'
    this.dropdownEl.style.cssText = `
      position: fixed;
      z-index: 10000;
      min-width: 300px;
      max-width: 600px;
      max-height: 340px;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      background: var(--theme-bg, #1e1e1e);
      border: 1px solid var(--theme-border, rgba(255,255,255,0.1));
      font-family: var(--theme-font, monospace);
      font-size: 13px;
      color: var(--theme-fg, #ccc);
      display: none;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
    `

    // 输入预览
    const header = document.createElement('div')
    header.style.cssText = 'padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);'
    header.innerHTML = '<span style="color: rgba(255,255,255,0.5); font-style: italic;" class="ct-input-preview"></span>'
    this.dropdownEl.appendChild(header)

    // 列表容器
    const list = document.createElement('div')
    list.className = 'ct-list'
    list.style.cssText = 'max-height: 260px; overflow-y: auto; overflow-x: hidden;'
    this.dropdownEl.appendChild(list)

    // 底部提示
    const footer = document.createElement('div')
    footer.style.cssText = 'display: flex; gap: 12px; padding: 4px 10px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); font-size: 11px; color: rgba(255,255,255,0.4);'
    footer.innerHTML = '<span>↑↓ 选择</span><span>→ 补全</span><span>Enter 确认</span><span>Esc 取消</span>'
    this.dropdownEl.appendChild(footer)

    // 挂载到 document.body
    document.body.appendChild(this.dropdownEl)

    // 监听键盘事件
    document.addEventListener('keydown', this.onKeyDown, true)

    this.logger.info('Dropdown DOM created')
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.dropdownVisible || this.currentSuggestions.length === 0) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        this.moveSelection(-1)
        break
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        this.moveSelection(1)
        break
      case 'ArrowRight':
        event.preventDefault()
        event.stopPropagation()
        this.confirmSelection()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        this.hideDropdown()
        break
      // Enter 不拦截，让终端正常执行命令
      // onInput 中的 \r 处理会自动记录命令并隐藏下拉列表
    }
  }

  private moveSelection (delta: number): void {
    this.selectedIndex = Math.max(0, Math.min(this.currentSuggestions.length - 1, this.selectedIndex + delta))
    this.renderList()
  }

  private confirmSelection (): void {
    if (this.currentSuggestions.length === 0) return
    const command = this.currentSuggestions[this.selectedIndex].entry.command
    this.injectCommand(this.attachedTab?.session, command)
  }

  /** 根据当前建议列表和选中索引重新渲染下拉列表中的每一项 */
  private renderList (): void {
    if (!this.dropdownEl) return
    const list = this.dropdownEl.querySelector('.ct-list') as HTMLElement
    if (!list) return

    list.innerHTML = ''
    for (let i = 0; i < this.currentSuggestions.length; i++) {
      const item = this.currentSuggestions[i]
      const el = document.createElement('div')
      el.style.cssText = `
        padding: 5px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: ${i === this.selectedIndex ? 'var(--theme-accent, #4a9eff)' : 'transparent'};
        color: ${i === this.selectedIndex ? 'var(--theme-bg, #1e1e1e)' : 'inherit'};
      `

      const badge = document.createElement('span')
      badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        flex-shrink: 0;
        background: ${item.matchType === 'prefix' ? 'rgba(76,175,80,0.3)' : 'rgba(255,193,7,0.3)'};
        color: ${item.matchType === 'prefix' ? '#4caf50' : '#ffc107'};
      `
      badge.textContent = item.matchType === 'prefix' ? 'P' : 'F'
      el.appendChild(badge)

      const cmd = document.createElement('span')
      cmd.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis;'
      cmd.textContent = item.entry.command
      el.appendChild(cmd)

      if (this.config.showSourceTag) {
        const src = document.createElement('span')
        src.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.4); padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.05); flex-shrink: 0;'
        src.textContent = item.entry.source
        el.appendChild(src)
      }

      el.addEventListener('mouseenter', () => {
        this.selectedIndex = i
        this.renderList()
      })
      el.addEventListener('click', () => {
        this.selectedIndex = i
        this.confirmSelection()
      })

      list.appendChild(el)
    }
  }

  /** 检测 Shell 类型，加载历史记录，并订阅终端输入事件 */
  private onSessionChanged (tab: BaseTerminalTabComponent, session: any): void {
    const env = session.environment || {}
    const processName = session.processName || ''
    const shellInfo = this.shellDetector.detect(env, processName)
    this.currentShellType = shellInfo.type !== 'unknown' ? shellInfo.type : 'bash'
    this.currentProfileId = (tab as any).profile?.id || 'default'
    this.logger.info(`Shell: ${this.currentShellType}, Profile: ${this.currentProfileId}`)

    this.loadShellHistory(shellInfo.historyFile)

    const inputSub = tab.input$.subscribe(data => {
      this.onInput(tab, data)
    })
    this.subscriptions.push(inputSub)
    this.logger.info('Input subscription attached')
  }

  /** 读取 Shell 历史文件并与 Tabby 历史合并 */
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
        this.logger.info(`Loaded ${merged.length} history entries`)
      }
    } catch (err) {
      // 静默忽略
    }
  }

  /** 逐字符解析终端输入，维护 currentInput 并触发匹配或记录命令 */
  private onInput (tab: BaseTerminalTabComponent, data: Buffer): void {
    const str = data.toString()

    for (const char of str) {
      if (char === '\r' || char === '\n') {
        // 先用终端输出修正 currentInput（处理 Tab 补全的情况）
        this.syncInputFromOutput(tab)
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

  // 从终端输出中同步实际的输入内容（处理 Tab 补全等场景）
  private syncInputFromOutput (tab: BaseTerminalTabComponent): void {
    try {
      // 获取终端前端的屏幕内容
      const frontend = (tab as any).frontend
      if (!frontend) return

      // 尝试从终端获取当前行内容
      const buffer = frontend.xterm?.buffer?.active
      if (!buffer) return

      const cursorLine = buffer.getLine(buffer.cursorY)
      if (!cursorLine) return

      const lineText = cursorLine.translateToString(true)
      if (lineText && lineText.length > 0) {
        // 获取提示符后的实际命令内容
        // 通常提示符格式是 "user@host:~/path$ command"
        // 取最后一个 $ 或 % 之后的内容
        const promptMatch = lineText.match(/[$%#>]\s*(.*)$/)
        if (promptMatch && promptMatch[1]) {
          const actualCommand = promptMatch[1].trim()
          if (actualCommand.length > 0) {
            this.currentInput = actualCommand
          }
        }
      }
    } catch (err) {
      // 静默忽略，回退到 currentInput
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

  /** 执行匹配流程：获取历史、匹配、排序后显示下拉列表 */
  private executeMatch (): void {
    if (!this.config.enabled) return
    if (this.currentInput.length < this.config.minChars) {
      this.hideDropdown()
      return
    }

    this.createDropdown()

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

    this.currentSuggestions = sortedResults
    this.selectedIndex = 0
    this.showDropdown()
  }

  private showDropdown (): void {
    if (!this.dropdownEl) return

    // 更新输入预览
    const preview = this.dropdownEl.querySelector('.ct-input-preview')
    if (preview) preview.textContent = this.currentInput

    this.renderList()

    this.dropdownEl.style.display = 'block'
    this.dropdownVisible = true
  }

  private hideDropdown (): void {
    if (!this.dropdownEl) return
    this.dropdownEl.style.display = 'none'
    this.dropdownVisible = false
    this.currentSuggestions = []
  }

  /** 将选中的命令注入终端：先删除当前输入，再写入新命令 */
  private injectCommand (session: any, command: string): void {
    if (!session) return
    for (let i = 0; i < this.currentInput.length; i++) {
      session.write(Buffer.from('\x7f'))
    }
    session.write(Buffer.from(command))
    this.currentInput = command
    this.hideDropdown()
  }

  /** 解除装饰器绑定，清理所有订阅、定时器和 DOM 元素 */
  detach (tab: BaseTerminalTabComponent): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    if (this.dropdownEl) {
      this.dropdownEl.remove()
      this.dropdownEl = null
    }
    document.removeEventListener('keydown', this.onKeyDown, true)
  }
}
