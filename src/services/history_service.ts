/** 命令历史服务：管理 Shell 历史文件解析、Tabby 内命令记录及持久化存储。 */

import { Injectable } from '@angular/core'
import { ConfigService, LogService, Logger } from 'tabby-core'

import { HistoryEntry } from '../models'

/** Tabby 配置存储中命令历史数据的键名。 */
const STORAGE_KEY = 'commandTipsHistory'

/** 命令历史管理器，负责解析各 Shell 历史文件、记录 Tabby 内命令及持久化存储。 */
@Injectable()
export class HistoryService {
  private readonly logger: Logger
  private readonly tabbyHistory: Map<string, HistoryEntry[]> = new Map()

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
      // 尝试多种方式读取
      let stored: any = cs._store?.[STORAGE_KEY]
      if (!stored) {
        try { stored = cs.__getValue?.(STORAGE_KEY) } catch (e) { /* ignore */ }
      }
      if (!stored) {
        try { stored = this.configService.store[STORAGE_KEY] } catch (e) { /* ignore */ }
      }
      if (stored && typeof stored === 'object') {
        for (const [profileId, entries] of Object.entries(stored)) {
          this.tabbyHistory.set(profileId, entries as HistoryEntry[])
        }
        this.logger.info(`Loaded history for ${this.tabbyHistory.size} profiles`)
      }
    } catch (err) {
      this.logger.warn('Failed to load history from storage:', err)
    }
  }

  private saveToStorage (): void {
    try {
      const obj: Record<string, HistoryEntry[]> = {}
      for (const [profileId, entries] of this.tabbyHistory) {
        obj[profileId] = entries
      }
      const cs = this.configService as any
      // 尝试多种方式写入
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

    let entries = this.tabbyHistory.get(profileId) || []
    const existing = entries.find(e => e.command === command)

    if (existing) {
      existing.count++
      existing.timestamp = Date.now()
    } else {
      entries.push({
        command,
        source: 'tabby',
        shellType,
        profileId,
        timestamp: Date.now(),
        count: 1,
      })
    }

    this.tabbyHistory.set(profileId, entries)
    this.saveToStorage()
  }

  /** 获取指定 Profile 的 Tabby 记录条目。 */
  public getTabbyEntries (profileId: string): HistoryEntry[] {
    return this.tabbyHistory.get(profileId) || []
  }

  /** 清空指定 Profile 的 Tabby 记录并持久化。 */
  public clearProfile (profileId: string): void {
    this.tabbyHistory.set(profileId, [])
    this.saveToStorage()
  }

  public setTabbyEntries (profileId: string, entries: HistoryEntry[]): void {
    this.tabbyHistory.set(profileId, entries)
    this.saveToStorage()
  }

  public getProfileCount (profileId: string): number {
    return (this.tabbyHistory.get(profileId) || []).length
  }

  public getAllProfileIds (): string[] {
    return Array.from(this.tabbyHistory.keys())
  }
}
