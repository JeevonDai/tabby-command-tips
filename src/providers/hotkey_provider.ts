/** 注册插件的快捷键描述，供 Tabby 设置页面展示。 */
import { Injectable } from '@angular/core'
import { HotkeyProvider, HotkeyDescription } from 'tabby-core'
import { CommandTipsI18nService } from '../services/i18n_service'

@Injectable()
export class CommandTipsHotkeyProvider extends HotkeyProvider {
  constructor (private readonly i18n: CommandTipsI18nService) {
    super()
  }

  async provide (): Promise<HotkeyDescription[]> {
    return [
      {
        id: 'command-tips.toggle',
        name: this.i18n.t('Toggle command history tips'),
      },
      {
        id: 'command-tips.clear-profile',
        name: this.i18n.t('Clear current profile Tabby history'),
      },
    ]
  }
}
