/** 命令历史服务：管理 Shell 历史文件解析、Tabby 内命令记录及持久化存储。 */

import { Injectable } from '@angular/core'
import { ConfigService, LogService, Logger } from 'tabby-core'

import { HistoryEntry } from '../models'

/** Tabby 配置存储中命令历史数据的键名。 */
const STORAGE_KEY = 'commandTipsHistory'

/** 持久化 debounce 延迟（毫秒）。 */
const SAVE_DEBOUNCE_MS = 2000

/** 命令历史管理器，负责解析各 Shell 历史文件、记录 Tabby 内命令及持久化存储。 */
@Injectable()
export class HistoryService {
  private readonly logger: Logger
  private readonly tabbyHistory: Map<string, HistoryEntry[]> = new Map()
  /** 命令→条目的二级索引，用于 O(1) 查找。 */
  private readonly commandIndex: Map<string, Map<string, HistoryEntry>> = new Map()
  /** 当前激活的 profileId，供设置页读取。 */
  private currentProfileId = 'default'
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor (
    private configService: ConfigService,
    private log: LogService,
  ) {
    this.logger = log.create('command-tips')
    this.loadFromStorage()
  }

  private loadFromStorage (): void {
    try {
      const cs = this.configService as any
      let stored: any = cs._store?.[STORAGE_KEY]
      if (!stored) {
        try { stored = cs.__getValue?.(STORAGE_KEY) } catch (e) { /* ignore */ }
      }
      if (!stored) {
        try { stored = this.configService.store[STORAGE_KEY] } catch (e) { /* ignore */ }
      }
      if (stored && typeof stored === 'object') {
        for (const [profileId, entries] of Object.entries(stored)) {
          const list = entries as HistoryEntry[]
          this.tabbyHistory.set(profileId, list)
          this.rebuildIndex(profileId, list)
        }
        this.logger.info(`Loaded history for ${this.tabbyHistory.size} profiles`)
      }
    } catch (err) {
      this.logger.warn('Failed to load history from storage:', err)
    }
  }

  /** 重建指定 profile 的命令索引。 */
  private rebuildIndex (profileId: string, entries: HistoryEntry[]): void {
    const idx = new Map<string, HistoryEntry>()
    for (const entry of entries) {
      idx.set(entry.command, entry)
    }
    this.commandIndex.set(profileId, idx)
  }

  /** 获取指定 profile 的命令索引，惰性创建。 */
  private getIndex (profileId: string): Map<string, HistoryEntry> {
    let idx = this.commandIndex.get(profileId)
    if (!idx) {
      idx = new Map()
      this.commandIndex.set(profileId, idx)
      // 从现有条目构建索引
      const entries = this.tabbyHistory.get(profileId) || []
      for (const entry of entries) {
        idx.set(entry.command, entry)
      }
    }
    return idx
  }

  /** debounce 后持久化到存储。 */
  private scheduleSave (): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.flushSave()
    }, SAVE_DEBOUNCE_MS)
  }

  /** 立即持久化到存储。 */
  private flushSave (): void {
    try {
      const obj: Record<string, HistoryEntry[]> = {}
      for (const [profileId, entries] of this.tabbyHistory) {
        obj[profileId] = entries
      }
      const cs = this.configService as any
      if (typeof cs.__setValue === 'function') {
        cs.__setValue(STORAGE_KEY, obj)
      } else if (cs._store) {
        cs._store[STORAGE_KEY] = obj
      }
      this.configService.save()
    } catch (err) {
      this.logger.warn('Failed to save history to storage:', err)
    }
  }

  /** 合并 Shell 历史和 Tabby 记录，相同命令的计数和时间戳取最大值。 */
  public mergeEntries (shellEntries: HistoryEntry[], tabbyEntries: HistoryEntry[]): HistoryEntry[] {
    const map = new Map<string, HistoryEntry>()

    for (const entry of shellEntries) {
      const key = `${entry.command}||${entry.profileId}`
      map.set(key, { ...entry })
    }

    for (const entry of tabbyEntries) {
      const key = `${entry.command}||${entry.profileId}`
      const existing = map.get(key)
      if (existing) {
        existing.timestamp = Math.max(existing.timestamp, entry.timestamp)
        existing.count += entry.count
        existing.source = 'tabby'
      } else {
        map.set(key, { ...entry })
      }
    }

    return Array.from(map.values())
  }

  /** 解析 Bash 历史文件，每行为一条命令。 */
  public parseBashHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(command => ({
        command,
        source: 'shell' as const,
        shellType,
        profileId,
        timestamp: 0,
        count: 1,
      }))
  }

  /** 解析 Zsh 历史文件，支持 `: timestamp:duration;command` 扩展格式。 */
  public parseZshHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const match = line.match(/^: (\d+):\d+;(.+)$/)
        if (match) {
          return {
            command: match[2],
            source: 'shell' as const,
            shellType,
            profileId,
            timestamp: parseInt(match[1], 10) * 1000,
            count: 1,
          }
        }
        return {
          command: line,
          source: 'shell' as const,
          shellType,
          profileId,
          timestamp: 0,
          count: 1,
        }
      })
  }

  /** 解析 Fish 历史文件，支持 `- cmd:` / `  when:` 多行格式。 */
  public parseFishHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const lines = content.split('\n')
    let currentCmd: string | null = null
    let currentWhen = 0

    for (const line of lines) {
      const cmdMatch = line.match(/^- cmd: (.+)$/)
      const whenMatch = line.match(/^  when: (\d+)$/)

      if (cmdMatch) {
        currentCmd = cmdMatch[1]
      } else if (whenMatch && currentCmd) {
        currentWhen = parseInt(whenMatch[1], 10)
        entries.push({
          command: currentCmd,
          source: 'shell',
          shellType,
          profileId,
          timestamp: currentWhen * 1000,
          count: 1,
        })
        currentCmd = null
        currentWhen = 0
      }
    }

    return entries
  }

  /** 解析 PowerShell (PSReadLine) 历史文件，每行为一条命令。 */
  public parsePowerShellHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(command => ({
        command,
        source: 'shell' as const,
        shellType,
        profileId,
        timestamp: 0,
        count: 1,
      }))
  }

  /** 根据 Shell 类型分派到对应的解析方法。 */
  public parseHistoryContent (content: string, shellType: string, profileId: string): HistoryEntry[] {
    switch (shellType) {
      case 'zsh':
        return this.parseZshHistory(content, shellType, profileId)
      case 'fish':
        return this.parseFishHistory(content, shellType, profileId)
      case 'powershell':
        return this.parsePowerShellHistory(content, shellType, profileId)
      default:
        return this.parseBashHistory(content, shellType, profileId)
    }
  }

  /** 记录用户在 Tabby 中执行的命令，更新计数和时间戳并持久化。 */
  public recordCommand (command: string, profileId: string, shellType: string): void {
    if (!command.trim()) return

    const idx = this.getIndex(profileId)
    const existing = idx.get(command)

    if (existing) {
      existing.count++
      existing.timestamp = Date.now()
    } else {
      const entry: HistoryEntry = {
        command,
        source: 'tabby',
        shellType,
        profileId,
        timestamp: Date.now(),
        count: 1,
      }
      let entries = this.tabbyHistory.get(profileId)
      if (!entries) {
        entries = []
        this.tabbyHistory.set(profileId, entries)
      }
      entries.push(entry)
      idx.set(command, entry)
    }

    this.scheduleSave()
  }

  /** 获取指定 Profile 的 Tabby 记录条目。 */
  public getTabbyEntries (profileId: string): HistoryEntry[] {
    return this.tabbyHistory.get(profileId) || []
  }

  /** 清空指定 Profile 的 Tabby 记录并持久化。 */
  public clearProfile (profileId: string): void {
    this.tabbyHistory.set(profileId, [])
    this.commandIndex.set(profileId, new Map())
    this.scheduleSave()
  }

  public setTabbyEntries (profileId: string, entries: HistoryEntry[]): void {
    this.tabbyHistory.set(profileId, entries)
    this.rebuildIndex(profileId, entries)
    this.scheduleSave()
  }

  public getProfileCount (profileId: string): number {
    return (this.tabbyHistory.get(profileId) || []).length
  }

  public getAllProfileIds (): string[] {
    return Array.from(this.tabbyHistory.keys())
  }

  /** 更新当前激活的 profileId。 */
  public setCurrentProfileId (profileId: string): void {
    this.currentProfileId = profileId || 'default'
  }

  /** 获取当前激活的 profileId。 */
  public getCurrentProfileId (): string {
    return this.currentProfileId
  }

  /** 在插件卸载时确保数据写入存储。 */
  public dispose (): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
      this.flushSave()
    }
  }
}
