/** 提供插件的默认配置，注入到 Tabby 的配置系统中。 */
import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'
import { DEFAULT_CONFIG } from '../models'

@Injectable()
export class CommandTipsConfigProvider extends ConfigProvider {
  defaults = {
    commandTips: { ...DEFAULT_CONFIG },
  }

  constructor () {
    super()
  }
}
