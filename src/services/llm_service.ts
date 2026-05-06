/** LLM 服务：封装 LLM API 调用逻辑，支持命令补全和命令建议。 */

import { Injectable } from '@angular/core'

import {
  LlmConfig,
  LlmContext,
  LlmResult,
  LlmError,
  LlmErrorType,
} from '../models'

/** LLM API 请求体结构。 */
interface LlmRequestBody {
  model: string
  messages: Array<{ role: string; content: string }>
  max_tokens: number
  temperature: number
}

/** LLM API 响应体结构。 */
interface LlmResponseBody {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/** LLM 服务，提供命令补全和命令建议功能。 */
@Injectable()
export class LlmService {
  private config: LlmConfig | null = null
  private retryCount = 0
  private maxRetries = 3

  /** 设置 LLM 配置。 */
  public setConfig (config: LlmConfig): void {
    this.config = config
    this.retryCount = 0
  }

  /** 检查 LLM 服务是否可用。 */
  public isAvailable (): boolean {
    return this.config !== null && this.config.enabled && this.config.apiKey !== ''
  }

  /** 命令补全：根据输入前缀预测完整命令。 */
  public async complete (input: string, context: LlmContext): Promise<LlmResult[]> {
    if (!this.isAvailable()) {
      return []
    }

    const prompt = this.buildCompletionPrompt(input, context)
    return this.callLlm(prompt, 'completion')
  }

  /** 命令建议：根据上下文推荐相关命令。 */
  public async suggest (input: string, context: LlmContext): Promise<LlmResult[]> {
    if (!this.isAvailable()) {
      return []
    }

    const prompt = this.buildSuggestionPrompt(input, context)
    return this.callLlm(prompt, 'suggestion')
  }

  /** 构建命令补全提示词。 */
  private buildCompletionPrompt (input: string, context: LlmContext): string {
    return `You are a command line expert. Complete the following command prefix.
Current directory: ${context.currentDirectory}
Shell type: ${context.shellType}
Recent commands: ${context.recentCommands.slice(0, 5).join(', ')}

Command prefix: ${input}

Provide ${this.config?.maxResults || 5} command completions as a JSON array of objects with "command" and "description" fields.
Example: [{"command": "git status", "description": "Show working tree status"}]`
  }

  /** 构建命令建议提示词。 */
  private buildSuggestionPrompt (input: string, context: LlmContext): string {
    return `You are a command line expert. Suggest relevant commands based on the context.
Current directory: ${context.currentDirectory}
Shell type: ${context.shellType}
User: ${context.currentUser}
Recent commands: ${context.recentCommands.slice(0, 5).join(', ')}
Current input: ${input || '(empty)'}

Provide ${this.config?.maxResults || 5} command suggestions as a JSON array of objects with "command" and "description" fields.
Example: [{"command": "git log --oneline", "description": "Show compact commit history"}]`
  }

  /** 调用 LLM API。 */
  private async callLlm (prompt: string, matchType: 'completion' | 'suggestion'): Promise<LlmResult[]> {
    if (!this.config) {
      throw this.createError(LlmErrorType.CONFIG_ERROR, 'LLM config not set')
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const requestBody: LlmRequestBody = {
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are a helpful command line assistant. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw this.createError(LlmErrorType.AUTH_ERROR, `Authentication failed: ${response.status}`)
        }
        throw this.createError(LlmErrorType.API_ERROR, `API error: ${response.status}`)
      }

      const data: LlmResponseBody = await response.json()
      return this.parseResponse(data, matchType)
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createError(LlmErrorType.TIMEOUT, 'Request timeout')
        }
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          throw this.createError(LlmErrorType.NETWORK_ERROR, 'Network error')
        }
      }

      throw error
    }
  }

  /** 解析 LLM API 响应。 */
  private parseResponse (data: LlmResponseBody, matchType: 'completion' | 'suggestion'): LlmResult[] {
    try {
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw this.createError(LlmErrorType.PARSE_ERROR, 'Empty response')
      }

      // 尝试从响应中提取 JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw this.createError(LlmErrorType.PARSE_ERROR, 'No JSON array found in response')
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ command: string; description?: string }>

      return parsed.slice(0, this.config?.maxResults || 5).map((item, index) => ({
        command: item.command,
        description: item.description,
        matchType,
        confidence: 1 - (index * 0.1), // 简单的置信度递减
      }))
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw this.createError(LlmErrorType.PARSE_ERROR, 'Invalid JSON in response')
      }
      throw error
    }
  }

  /** 创建 LLM 错误对象。 */
  private createError (type: LlmErrorType, message: string): LlmError {
    return {
      type,
      message,
      retryable: type === LlmErrorType.NETWORK_ERROR || type === LlmErrorType.TIMEOUT,
    }
  }

  /** 带重试的 LLM 调用。 */
  public async callWithRetry (fn: () => Promise<LlmResult[]>): Promise<LlmResult[]> {
    this.retryCount = 0

    while (this.retryCount < this.maxRetries) {
      try {
        return await fn()
      } catch (error) {
        const llmError = error as LlmError
        if (!llmError.retryable || this.retryCount >= this.maxRetries - 1) {
          throw error
        }
        this.retryCount++
        await this.delay(Math.pow(2, this.retryCount) * 100)
      }
    }

    return []
  }

  /** 延迟函数。 */
  private delay (ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}