/** 命令提示插件 i18n：跟随 Tabby config.store.language 切换界面语言。 */
import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { Subject } from 'rxjs'
import { filter, take } from 'rxjs/operators'
import { COMMAND_TIPS_TRANSLATIONS } from '../locale'

const DEFAULT_LOCALE = 'en-US'

function resolveTranslation (locale: string, key: string): string | undefined {
  if (COMMAND_TIPS_TRANSLATIONS[locale]?.[key]) {
    return COMMAND_TIPS_TRANSLATIONS[locale][key]
  }

  const lang = locale.split('-')[0]
  for (const loc of Object.keys(COMMAND_TIPS_TRANSLATIONS)) {
    if (loc.startsWith(`${lang}-`) && COMMAND_TIPS_TRANSLATIONS[loc][key]) {
      return COMMAND_TIPS_TRANSLATIONS[loc][key]
    }
  }

  return undefined
}

function interpolate (text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  let result = text
  for (const [param, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value))
  }
  return result
}

@Injectable()
export class CommandTipsI18nService {
  private locale = DEFAULT_LOCALE
  private readonly localeChanged = new Subject<void>()

  /** 语言切换时发出通知，供 UI 组件触发变更检测。 */
  readonly localeChanged$ = this.localeChanged.asObservable()

  constructor (private readonly config: ConfigService) {
    // config.store 在 Tabby 启动早期可能尚未就绪，需等 ready$ 后再读取
    this.config.ready$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.updateLocale()
    })
    this.config.changed$.subscribe(() => this.updateLocale())
  }

  private updateLocale (): void {
    const store = this.config.store
    if (!store) {
      return
    }
    const nextLocale = store.language || DEFAULT_LOCALE
    if (nextLocale === this.locale) return
    this.locale = nextLocale
    this.localeChanged.next()
  }

  /** 翻译键（英文原文）；非中文语言回退为键本身。 */
  t (key: string, params?: Record<string, string | number>): string {
    const translation = resolveTranslation(this.locale, key) ?? key
    return interpolate(translation, params)
  }
}
