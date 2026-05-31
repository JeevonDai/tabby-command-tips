// 插件设置页面组件，提供触发、匹配、排序、显示等配置选项
import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

import { HistoryService } from '../services/history_service'
import { CommandTipsConfig, DEFAULT_CONFIG, DEFAULT_LLM_CONFIG, HistoryEntry } from '../models'

/** 插件的设置页面组件，负责配置的读取、展示与持久化 */
@Component({
  template: require('./settings_tab_component.pug'),
  styles: [require('./settings_tab_component.scss')],
})
export class SettingsTabComponent {
  public draggingRowIndex: number | null = null
  public config: CommandTipsConfig = {
    ...DEFAULT_CONFIG,
    scoring: { ...DEFAULT_CONFIG.scoring },
    acceptKeys: { ...DEFAULT_CONFIG.acceptKeys },
  }

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
        acceptKeys: {
          enter: stored.acceptKeys?.enter ?? DEFAULT_CONFIG.acceptKeys.enter,
          arrowRight: stored.acceptKeys?.arrowRight ?? DEFAULT_CONFIG.acceptKeys.arrowRight,
        },
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

  /** 返回当前 profile 的历史命令条数 */
  get profileHistoryCount (): number {
    return this.historyService.getProfileCount(this.currentProfileId)
  }

  /** 当前激活的 profileId（由终端装饰器同步）。 */
  get currentProfileId (): string {
    return this.historyService.getCurrentProfileId()
  }

  /** 当前 profile 的命令列表（可直接编辑）。 */
  get currentProfileEntries (): HistoryEntry[] {
    return this.historyService.getTabbyEntries(this.currentProfileId)
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
    if (!store.acceptKeys) {
      store.acceptKeys = { ...DEFAULT_CONFIG.acceptKeys }
    }
    store.acceptKeys.enter = this.config.acceptKeys.enter
    store.acceptKeys.arrowRight = this.config.acceptKeys.arrowRight

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

  /** 清空当前 profile 的历史命令记录 */
  clearHistory (): void {
    this.historyService.clearProfile(this.currentProfileId)
  }

  /** 新增一条可编辑命令。 */
  addProfileCommand (): void {
    const entries = [...this.currentProfileEntries]
    entries.push({
      command: '',
      source: 'tabby',
      shellType: entries[0]?.shellType || 'bash',
      profileId: this.currentProfileId,
      timestamp: Date.now(),
      count: 1,
    })
    this.historyService.setTabbyEntries(this.currentProfileId, entries)
  }

  /** 删除指定行命令。 */
  removeProfileCommand (index: number): void {
    const entries = [...this.currentProfileEntries]
    entries.splice(index, 1)
    this.saveCurrentProfileEntries(entries)
  }

  /** 命令内容被编辑后保存。 */
  onProfileCommandEdited (): void {
    this.saveCurrentProfileEntries(this.currentProfileEntries)
  }

  /** 拖拽开始。 */
  onRowDragStart (index: number): void {
    this.draggingRowIndex = index
  }

  /** 拖拽经过目标行时允许放置。 */
  onRowDragOver (event: DragEvent): void {
    event.preventDefault()
  }

  /** 放置后重排并保存。 */
  onRowDrop (targetIndex: number): void {
    if (this.draggingRowIndex === null || this.draggingRowIndex === targetIndex) return
    const entries = [...this.currentProfileEntries]
    const [moved] = entries.splice(this.draggingRowIndex, 1)
    entries.splice(targetIndex, 0, moved)
    this.draggingRowIndex = null
    this.saveCurrentProfileEntries(entries)
  }

  /** 拖拽结束，清理状态。 */
  onRowDragEnd (): void {
    this.draggingRowIndex = null
  }

  /** 清洗/去重后保存当前 profile 命令列表。 */
  private saveCurrentProfileEntries (entries: HistoryEntry[]): void {
    const normalized = this.normalizeEntries(entries)
    this.historyService.setTabbyEntries(this.currentProfileId, normalized)
  }

  /** 去掉空命令，并合并重复命令。 */
  private normalizeEntries (entries: HistoryEntry[]): HistoryEntry[] {
    const merged = new Map<string, HistoryEntry>()
    const result: HistoryEntry[] = []

    for (const item of entries) {
      const command = (item.command || '').trim()
      if (!command) continue

      const normalized: HistoryEntry = {
        ...item,
        command,
        source: item.source || 'tabby',
        shellType: item.shellType || 'bash',
        profileId: this.currentProfileId,
        timestamp: item.timestamp || Date.now(),
        count: Math.max(1, item.count || 1),
      }

      const existing = merged.get(command)
      if (!existing) {
        merged.set(command, normalized)
        result.push(normalized)
        continue
      }

      existing.count += normalized.count
      existing.timestamp = Math.max(existing.timestamp, normalized.timestamp)
      if (existing.source !== 'tabby') existing.source = normalized.source
    }

    return result
  }
}
