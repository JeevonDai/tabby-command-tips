import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { HistoryService } from '../services/history.service'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

@Component({
  template: require('./settingsTab.component.pug'),
  styles: [require('./settingsTab.component.scss')],
})
export class SettingsTabComponent {
  config: CommandTipsConfig = DEFAULT_CONFIG

  constructor (
    private configService: ConfigService,
    private historyService: HistoryService,
  ) {
    this.config = this.configService.store.commandTips || { ...DEFAULT_CONFIG }
  }

  get profileHistoryCount (): number {
    const activeProfile = (this.configService.store as any).activeProfile || 'default'
    return this.historyService.getProfileCount(activeProfile)
  }

  save (): void {
    this.configService.store.commandTips = { ...this.config }
    this.configService.save()
  }

  clearHistory (): void {
    const activeProfile = (this.configService.store as any).activeProfile || 'default'
    this.historyService.clearProfile(activeProfile)
    this.configService.store.commandTips = { ...this.config }
    this.configService.save()
  }
}
