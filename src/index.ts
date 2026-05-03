import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider } from 'tabby-core'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
  ],
})
export default class CommandTipsModule {}
