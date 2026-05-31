/** 历史命令条目的数据结构。 */
export interface HistoryEntry {
  command: string
  source: 'shell' | 'tabby' | 'llm'
  shellType: string
  profileId: string
  timestamp: number
  count: number
}

/** LLM 调用所需的上下文信息。 */
export interface LlmContext {
  currentDirectory: string
  recentCommands: string[]
  shellType: string
  currentUser: string
}

/** LLM 返回的匹配结果。 */
export interface LlmResult {
  command: string
  description?: string
  matchType: 'completion' | 'suggestion'
  confidence: number
}

/** LLM 错误类型枚举。 */
export enum LlmErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

/** LLM 错误信息。 */
export interface LlmError {
  type: LlmErrorType
  message: string
  retryable: boolean
}

/** LLM 配置。 */
export interface LlmConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'local'
  endpoint: string
  apiKey: string
  model: string
  maxResults: number
  timeoutMs: number
  modes: ('completion' | 'suggestion')[]
}

/** 插件配置的数据结构，控制匹配、排序和显示行为。 */
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
  /** 确认选中项的快捷键开关 */
  acceptKeys: {
    enter: boolean
    arrowRight: boolean
  }
  llm: LlmConfig
}

/** LLM 默认配置值。 */
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  maxResults: 5,
  timeoutMs: 3000,
  modes: ['completion'],
}

/** 插件的默认配置值。 */
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
  acceptKeys: {
    enter: true,
    arrowRight: true,
  },
  llm: DEFAULT_LLM_CONFIG,
}
