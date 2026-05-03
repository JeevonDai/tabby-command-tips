import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider } from 'tabby-core'
import { CommandTipsConfigProvider } from './providers/configProvider'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
  ],
})
export default class CommandTipsModule {}
