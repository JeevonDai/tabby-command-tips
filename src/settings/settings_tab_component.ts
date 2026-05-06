// 插件设置页面组件，提供触发、匹配、排序、显示等配置选项
import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

import { HistoryService } from '../services/history_service'
import { CommandTipsConfig, DEFAULT_CONFIG, DEFAULT_LLM_CONFIG } from '../models'

/** 插件的设置页面组件，负责配置的读取、展示与持久化 */
@Component({
  template: require('./settings_tab_component.pug'),
  styles: [require('./settings_tab_component.scss')],
})
export class SettingsTabComponent {
  public config: CommandTipsConfig = { ...DEFAULT_CONFIG, scoring: { ...DEFAULT_CONFIG.scoring } }

  constructor (
    private readonly configService: ConfigService,
    private readonly historyService: HistoryService,
  ) {
    const stored = this.configService.store.commandTips
    if (stored) {
      this.config = {
        enabled: stored.enabled ?? DEFAULT_CONFIG.enabled,
        minChars: stored.minChars ?? DEFAULT_CONFIG.minChars,
        debounceMs: stored.debounceMs ?? DEFAULT_CONFIG.debounceMs,
        maxResults: stored.maxResults ?? DEFAULT_CONFIG.maxResults,
        scoring: {
          recencyWeight: stored.scoring?.recencyWeight ?? DEFAULT_CONFIG.scoring.recencyWeight,
          frequencyWeight: stored.scoring?.frequencyWeight ?? DEFAULT_CONFIG.scoring.frequencyWeight,
          halfLifeDays: stored.scoring?.halfLifeDays ?? DEFAULT_CONFIG.scoring.halfLifeDays,
        },
        matching: stored.matching ?? DEFAULT_CONFIG.matching,
        showSourceTag: stored.showSourceTag ?? DEFAULT_CONFIG.showSourceTag,
        tabCompletesFirst: stored.tabCompletesFirst ?? DEFAULT_CONFIG.tabCompletesFirst,
        llm: {
          enabled: stored.llm?.enabled ?? DEFAULT_LLM_CONFIG.enabled,
          provider: stored.llm?.provider ?? DEFAULT_LLM_CONFIG.provider,
          endpoint: stored.llm?.endpoint ?? DEFAULT_LLM_CONFIG.endpoint,
          apiKey: stored.llm?.apiKey ?? DEFAULT_LLM_CONFIG.apiKey,
          model: stored.llm?.model ?? DEFAULT_LLM_CONFIG.model,
          maxResults: stored.llm?.maxResults ?? DEFAULT_LLM_CONFIG.maxResults,
          timeoutMs: stored.llm?.timeoutMs ?? DEFAULT_LLM_CONFIG.timeoutMs,
          modes: stored.llm?.modes ?? DEFAULT_LLM_CONFIG.modes,
        },
      }
    }
  }

  /** 返回所有 profile 的历史命令总条数 */
  get profileHistoryCount (): number {
    // 汇总所有 profile 的历史条数
    let total = 0
    for (const profileId of this.historyService.getAllProfileIds()) {
      total += this.historyService.getProfileCount(profileId)
    }
    return total
  }

  /** 将当前配置写入存储并持久化 */
  save (): void {
    const store = this.configService.store.commandTips
    store.enabled = this.config.enabled
    store.minChars = this.config.minChars
    store.debounceMs = this.config.debounceMs
    store.maxResults = this.config.maxResults
    store.scoring.recencyWeight = this.config.scoring.recencyWeight
    store.scoring.frequencyWeight = this.config.scoring.frequencyWeight
    store.scoring.halfLifeDays = this.config.scoring.halfLifeDays
    store.matching = this.config.matching
    store.showSourceTag = this.config.showSourceTag
    store.tabCompletesFirst = this.config.tabCompletesFirst

    // 保存 LLM 配置
    if (!store.llm) {
      store.llm = { ...DEFAULT_LLM_CONFIG }
    }
    store.llm.enabled = this.config.llm.enabled
    store.llm.provider = this.config.llm.provider
    store.llm.endpoint = this.config.llm.endpoint
    store.llm.apiKey = this.config.llm.apiKey
    store.llm.model = this.config.llm.model
    store.llm.maxResults = this.config.llm.maxResults
    store.llm.timeoutMs = this.config.llm.timeoutMs
    store.llm.modes = this.config.llm.modes

    this.configService.save()
  }

  /** 清空所有 profile 的历史命令记录 */
  clearHistory (): void {
    for (const profileId of this.historyService.getAllProfileIds()) {
      this.historyService.clearProfile(profileId)
    }
  }
}
