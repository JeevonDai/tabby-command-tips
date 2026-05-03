import { Injectable } from '@angular/core'
import { HotkeyProvider, Command } from 'tabby-core'

@Injectable()
export class CommandTipsHotkeyProvider extends HotkeyProvider {
  async provide (): Promise<Command[]> {
    return [
      {
        id: 'command-tips.toggle',
        name: '打开/关闭命令历史提示',
        icon: 'fas fa-history',
        defaultHotkey: 'Ctrl+Shift+P',
      },
      {
        id: 'command-tips.clear-profile',
        name: '清空当前 profile 的 Tabby 历史',
        icon: 'fas fa-trash',
      },
    ]
  }
}
