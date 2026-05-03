import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { SettingsTabComponent } from '../settings/settingsTab.component'

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
