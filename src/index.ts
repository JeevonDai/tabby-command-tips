import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { ConfigProvider, HotkeyProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { TerminalDecorator } from 'tabby-terminal'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'
import { CommandTipsSettingsTabProvider } from './providers/settingsTabProvider'
import { CommandTipsTerminalDecorator } from './decorators/terminal-decorator'
import { DropdownComponent } from './components/dropdown.component'
import { SettingsTabComponent } from './settings/settingsTab.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
  ],
  declarations: [
    DropdownComponent,
    SettingsTabComponent,
  ],
  entryComponents: [
    DropdownComponent,
    SettingsTabComponent,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
    { provide: SettingsTabProvider, useClass: CommandTipsSettingsTabProvider, multi: true },
    { provide: TerminalDecorator, useClass: CommandTipsTerminalDecorator, multi: true },
  ],
})
export default class CommandTipsModule {}
