import { Injectable } from '@angular/core'
import { ConfigService, LogService, Logger } from 'tabby-core'
import { HistoryEntry } from '../models'

const STORAGE_KEY = 'commandTipsHistory'

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private logger: Logger
  private tabbyHistory: Map<string, HistoryEntry[]> = new Map()

  constructor (
    private configService: ConfigService,
    private log: LogService,
  ) {
    this.logger = log.create('command-tips')
    this.loadFromStorage()
  }

  private loadFromStorage (): void {
    try {
      const stored = this.configService.store[STORAGE_KEY]
      if (stored && typeof stored === 'object') {
        for (const [profileId, entries] of Object.entries(stored)) {
          this.tabbyHistory.set(profileId, entries as HistoryEntry[])
        }
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
      this.configService.store[STORAGE_KEY] = obj
      this.configService.save()
    } catch (err) {
      this.logger.warn('Failed to save history to storage:', err)
    }
  }

  mergeEntries (shellEntries: HistoryEntry[], tabbyEntries: HistoryEntry[]): HistoryEntry[] {
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

  parseBashHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
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

  parseZshHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
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

  parseFishHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
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

  parsePowerShellHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
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

  parseHistoryContent (content: string, shellType: string, profileId: string): HistoryEntry[] {
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

  recordCommand (command: string, profileId: string, shellType: string): void {
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

  getTabbyEntries (profileId: string): HistoryEntry[] {
    return this.tabbyHistory.get(profileId) || []
  }

  clearProfile (profileId: string): void {
    this.tabbyHistory.set(profileId, [])
    this.saveToStorage()
  }

  setTabbyEntries (profileId: string, entries: HistoryEntry[]): void {
    this.tabbyHistory.set(profileId, entries)
    this.saveToStorage()
  }

  getProfileCount (profileId: string): number {
    return (this.tabbyHistory.get(profileId) || []).length
  }
}
