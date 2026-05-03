import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider } from 'tabby-core'
import { TerminalDecorator } from 'tabby-terminal'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'
import { CommandTipsTerminalDecorator } from './decorators/terminal-decorator'
import { DropdownComponent } from './components/dropdown.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  declarations: [
    DropdownComponent,
  ],
  entryComponents: [
    DropdownComponent,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
    { provide: TerminalDecorator, useClass: CommandTipsTerminalDecorator, multi: true },
  ],
})
export default class CommandTipsModule {}
