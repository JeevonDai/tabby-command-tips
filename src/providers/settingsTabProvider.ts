import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { SettingsTabComponent } from '../settings/settingsTab.component'

@Injectable()
export class CommandTipsSettingsTabProvider extends SettingsTabProvider {
  async getTabs () {
    return [{
      type: 'component',
      title: '命令历史提示',
      icon: 'fas fa-history',
      component: SettingsTabComponent,
    }]
  }
}
