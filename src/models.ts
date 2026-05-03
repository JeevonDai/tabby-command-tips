export interface HistoryEntry {
  command: string
  source: 'shell' | 'tabby'
  shellType: string
  profileId: string
  timestamp: number
  count: number
}

export interface CommandTipsConfig {
  enabled: boolean
  minChars: number
  debounceMs: number
  maxResults: number
  scoring: {
    recencyWeight: number
    frequencyWeight: number
    halfLifeDays: number
  }
  matching: 'prefix-fuzzy' | 'prefix-only' | 'fuzzy-only'
  showSourceTag: boolean
  tabCompletesFirst: boolean
}

export const DEFAULT_CONFIG: CommandTipsConfig = {
  enabled: true,
  minChars: 2,
  debounceMs: 300,
  maxResults: 20,
  scoring: {
    recencyWeight: 0.7,
    frequencyWeight: 0.3,
    halfLifeDays: 7,
  },
  matching: 'prefix-fuzzy',
  showSourceTag: false,
  tabCompletesFirst: true,
}
