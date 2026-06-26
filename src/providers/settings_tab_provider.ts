/** 提供插件设置页面的入口，在 Tabby 设置中注册标签页。 */
import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { CommandTipsI18nService } from '../services/i18n_service'
import { SettingsTabComponent } from '../settings/settings_tab_component'

@Injectable()
export class CommandTipsSettingsTabProvider extends SettingsTabProvider {
  id = 'command-tips'
  icon = 'fas fa-history'
  title = 'Command tips'
  weight = 0

  constructor (
    private readonly i18n: CommandTipsI18nService,
    private readonly config: ConfigService,
  ) {
    super()
    this.refreshTitle()
    this.i18n.localeChanged$.subscribe(() => this.refreshTitle())
    this.config.changed$.subscribe(() => this.refreshTitle())
  }

  private refreshTitle (): void {
    this.title = this.i18n.t('Command tips')
  }

  getComponentType (): any {
    return SettingsTabComponent
  }
}
