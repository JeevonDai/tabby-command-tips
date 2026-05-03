/** 提供插件设置页面的入口，在 Tabby 设置中注册标签页。 */
import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { SettingsTabComponent } from '../settings/settings_tab_component'

@Injectable()
export class CommandTipsSettingsTabProvider extends SettingsTabProvider {
  id = 'command-tips'
  icon = 'fas fa-history'
  title = '命令历史提示'
  weight = 0

  getComponentType (): any {
    return SettingsTabComponent
  }
}
