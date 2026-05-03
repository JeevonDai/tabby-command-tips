/** 命令历史提示插件的 Angular 模块入口，注册所有服务、组件和 Provider。 */
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ConfigProvider, HotkeyProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { TerminalDecorator } from 'tabby-terminal'

import { CommandTipsTerminalDecorator } from './decorators/terminal_decorator'
import { CommandTipsConfigProvider } from './providers/config_provider'
import { CommandTipsHotkeyProvider } from './providers/hotkey_provider'
import { CommandTipsSettingsTabProvider } from './providers/settings_tab_provider'
import { HistoryService } from './services/history_service'
import { MatchingService } from './services/matching_service'
import { ScoringService } from './services/scoring_service'
import { ShellDetectorService } from './services/shell_detector_service'
import { SettingsTabComponent } from './settings/settings_tab_component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
  ],
  declarations: [
    SettingsTabComponent,
  ],
  entryComponents: [
    SettingsTabComponent,
  ],
  providers: [
    MatchingService,
    ScoringService,
    ShellDetectorService,
    HistoryService,
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
    { provide: SettingsTabProvider, useClass: CommandTipsSettingsTabProvider, multi: true },
    { provide: TerminalDecorator, useClass: CommandTipsTerminalDecorator, multi: true },
  ],
})
/** 命令历史提示插件的 Angular 模块，声明组件并注册匹配、评分、历史等服务。 */
export default class CommandTipsModule {}
