import { Injectable } from '@angular/core'
import { HotkeyProvider, HotkeyDescription } from 'tabby-core'

@Injectable()
export class CommandTipsHotkeyProvider extends HotkeyProvider {
  async provide (): Promise<HotkeyDescription[]> {
    return [
      {
        id: 'command-tips.toggle',
        name: '打开/关闭命令历史提示',
      },
      {
        id: 'command-tips.clear-profile',
        name: '清空当前 profile 的 Tabby 历史',
      },
    ]
  }
}
