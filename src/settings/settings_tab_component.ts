// 插件设置页面组件，提供触发、匹配、排序、显示等配置选项
import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

import { HistoryService } from '../services/history_service'
import {
  CommandProfile,
  CommandTipsConfig,
  DEFAULT_COMMAND_PROFILE,
  DEFAULT_CONFIG,
  DEFAULT_LLM_CONFIG,
  HistoryEntry,
} from '../models'

/** 插件的设置页面组件，负责配置的读取、展示与持久化 */
@Component({
  template: require('./settings_tab_component.pug'),
  styles: [require('./settings_tab_component.scss')],
})
export class SettingsTabComponent {
  public draggingRowIndex: number | null = null
  /** 当前在「命令编辑」区域选中的配置组 id。 */
  public selectedProfileId = DEFAULT_COMMAND_PROFILE.id
  public config: CommandTipsConfig = {
    ...DEFAULT_CONFIG,
    scoring: { ...DEFAULT_CONFIG.scoring },
    acceptKeys: { ...DEFAULT_CONFIG.acceptKeys },
    profiles: [{ ...DEFAULT_COMMAND_PROFILE }],
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
        profiles: this.normalizeProfiles(stored.profiles),
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

    // 默认选中当前激活的配置组（若仍存在），否则回退到默认组
    const active = this.historyService.getCurrentProfileId()
    this.selectedProfileId = this.config.profiles.some(p => p.id === active)
      ? active
      : DEFAULT_COMMAND_PROFILE.id
  }

  /** 规范化配置组列表：保证始终存在默认组且 id 唯一。 */
  private normalizeProfiles (profiles: any): CommandProfile[] {
    const result: CommandProfile[] = []
    const seen = new Set<string>()
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        const id = (p?.id || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        result.push({
          id,
          name: (p?.name || id).trim(),
          pattern: typeof p?.pattern === 'string' ? p.pattern : '',
        })
      }
    }
    if (!seen.has(DEFAULT_COMMAND_PROFILE.id)) {
      result.unshift({ ...DEFAULT_COMMAND_PROFILE })
    }
    return result
  }

  /** 返回选中配置组的历史命令条数 */
  get profileHistoryCount (): number {
    return this.historyService.getProfileCount(this.selectedProfileId)
  }

  /** 当前终端激活的 profileId（由终端装饰器同步），用于提示展示。 */
  get activeProfileId (): string {
    return this.historyService.getCurrentProfileId()
  }

  /** 选中配置组的展示名称。 */
  get activeProfileName (): string {
    const id = this.activeProfileId
    const profile = this.config.profiles.find(p => p.id === id)
    return profile ? profile.name : id
  }

  /** 选中配置组的命令列表（可直接编辑）。 */
  get currentProfileEntries (): HistoryEntry[] {
    return this.historyService.getTabbyEntries(this.selectedProfileId)
  }

  /** 返回指定配置组的历史命令条数。 */
  historyCountOf (profileId: string): number {
    return this.historyService.getProfileCount(profileId)
  }

  /** 判断某配置组是否为默认组（默认组不可删除、id 不可编辑）。 */
  isDefaultProfile (profile: CommandProfile): boolean {
    return profile.id === DEFAULT_COMMAND_PROFILE.id
  }

  /** 新增一个命令配置组。 */
  addProfile (): void {
    const id = this.generateProfileId()
    this.config.profiles.push({ id, name: '新配置组', pattern: '' })
    this.selectedProfileId = id
    this.save()
  }

  /** 删除一个命令配置组（默认组除外），并清除其历史。 */
  removeProfile (profile: CommandProfile): void {
    if (this.isDefaultProfile(profile)) return
    this.config.profiles = this.config.profiles.filter(p => p.id !== profile.id)
    this.historyService.deleteProfile(profile.id)
    if (this.selectedProfileId === profile.id) {
      this.selectedProfileId = DEFAULT_COMMAND_PROFILE.id
    }
    this.save()
  }

  /** 配置组的名称 / 正则被编辑后保存。 */
  onProfileMetaChanged (): void {
    this.save()
  }

  /** 生成不重复的配置组 id。 */
  private generateProfileId (): string {
    let id = ''
    do {
      id = 'p' + Math.random().toString(36).slice(2, 8)
    } while (this.config.profiles.some(p => p.id === id))
    return id
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

    // 保存命令配置组（深拷贝，避免存储引用同一数组）
    store.profiles = this.config.profiles.map(p => ({
      id: p.id,
      name: (p.name || p.id).trim(),
      pattern: p.pattern || '',
    }))

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

  /** 清空选中配置组的历史命令记录 */
  clearHistory (): void {
    this.historyService.clearProfile(this.selectedProfileId)
  }

  /** 新增一条可编辑命令。 */
  addProfileCommand (): void {
    const entries = [...this.currentProfileEntries]
    entries.push({
      command: '',
      source: 'tabby',
      shellType: entries[0]?.shellType || 'bash',
      profileId: this.selectedProfileId,
      timestamp: Date.now(),
      count: 1,
    })
    this.historyService.setTabbyEntries(this.selectedProfileId, entries)
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

  /** 清洗/去重后保存选中配置组的命令列表。 */
  private saveCurrentProfileEntries (entries: HistoryEntry[]): void {
    const normalized = this.normalizeEntries(entries)
    this.historyService.setTabbyEntries(this.selectedProfileId, normalized)
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
        profileId: this.selectedProfileId,
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
