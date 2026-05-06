/** 命令匹配服务：提供前缀匹配和模糊匹配，从历史记录中筛选候选命令。 */

import { Injectable } from '@angular/core'
import { Observable, from, of, concat } from 'rxjs'
import { map, catchError } from 'rxjs/operators'

import { HistoryEntry, CommandTipsConfig, LlmContext, LlmResult } from '../models'
import { LlmService } from './llm_service'

/** 单条匹配结果，包含命中的历史条目及其匹配类型。 */
export interface MatchResult {
  entry: HistoryEntry
  matchType: 'prefix' | 'fuzzy' | 'llm-completion' | 'llm-suggestion'
  confidence?: number
  description?: string
}

/** 命令匹配引擎，根据用户输入从前缀和模糊两个维度筛选历史命令。 */
@Injectable()
export class MatchingService {
  constructor (private llmService: LlmService) {}
  /** 前缀匹配：筛选出以用户输入开头的历史命令。 */
  public prefixMatch (input: string, entries: HistoryEntry[]): MatchResult[] {
    if (!input) return []
    const lower = input.toLowerCase()
    return entries
      .filter(e => e.command.toLowerCase().startsWith(lower))
      .map(entry => ({ entry, matchType: 'prefix' as const }))
  }

  /** 模糊匹配：基于子序列算法筛选含用户输入字符顺序的历史命令。 */
  public fuzzyMatch (input: string, entries: HistoryEntry[], exclude?: Set<string>): MatchResult[] {
    if (!input) return []
    const lower = input.toLowerCase()
    return entries
      .filter(e => {
        if (exclude?.has(e.command)) return false
        return this.isSubsequence(lower, e.command.toLowerCase())
      })
      .map(entry => ({ entry, matchType: 'fuzzy' as const }))
  }

  /** 根据配置的匹配模式执行匹配，前缀结果优先于模糊结果。 */
  public execute (
    input: string,
    entries: HistoryEntry[],
    mode: CommandTipsConfig['matching'],
  ): MatchResult[] {
    if (!input) return []

    if (mode === 'prefix-only') {
      return this.prefixMatch(input, entries)
    }

    if (mode === 'fuzzy-only') {
      return this.fuzzyMatch(input, entries)
    }

    // prefix-fuzzy
    const prefixResults = this.prefixMatch(input, entries)
    const prefixCommands = new Set(prefixResults.map(r => r.entry.command))
    const fuzzyResults = this.fuzzyMatch(input, entries, prefixCommands)
    return [...prefixResults, ...fuzzyResults]
  }

  public isSubsequence (input: string, target: string): boolean {
    let inputIdx = 0
    let targetIdx = 0
    while (inputIdx < input.length && targetIdx < target.length) {
      if (input[inputIdx] === target[targetIdx]) {
        inputIdx++
      }
      targetIdx++
    }
    return inputIdx === input.length
  }

  /** 统一匹配接口：同时执行历史记录匹配和 LLM 匹配，返回结果流。 */
  public executeWithLlm (
    input: string,
    entries: HistoryEntry[],
    mode: CommandTipsConfig['matching'],
    llmContext: LlmContext,
  ): Observable<MatchResult[]> {
    if (!input) return of([])

    // 同步执行历史记录匹配
    const historyResults = this.execute(input, entries, mode)

    // 如果 LLM 不可用，直接返回历史记录结果
    if (!this.llmService.isAvailable()) {
      return of(historyResults)
    }

    // 异步执行 LLM 匹配
    const llmResults$ = from(this.getLlmResults(input, llmContext)).pipe(
      catchError(() => of([])),
    )

    // 先返回历史记录结果，再追加 LLM 结果
    return concat(
      of(historyResults),
      llmResults$.pipe(
        map(llmResults => [...historyResults, ...llmResults]),
      ),
    )
  }

  /** 获取 LLM 匹配结果。 */
  private async getLlmResults (input: string, context: LlmContext): Promise<MatchResult[]> {
    const results: MatchResult[] = []

    try {
      // 根据配置的模式执行 LLM 匹配
      const config = this.llmService['config']
      if (!config) return []

      if (config.modes.includes('completion')) {
        const completionResults = await this.llmService.callWithRetry(
          () => this.llmService.complete(input, context),
        )
        results.push(...this.convertLlmResults(completionResults, 'llm-completion'))
      }

      if (config.modes.includes('suggestion')) {
        const suggestionResults = await this.llmService.callWithRetry(
          () => this.llmService.suggest(input, context),
        )
        results.push(...this.convertLlmResults(suggestionResults, 'llm-suggestion'))
      }
    } catch (error) {
      // LLM 调用失败，静默降级
      console.warn('LLM matching failed:', error)
    }

    return results
  }

  /** 将 LLM 结果转换为 MatchResult 格式。 */
  private convertLlmResults (llmResults: LlmResult[], matchType: 'llm-completion' | 'llm-suggestion'): MatchResult[] {
    return llmResults.map(result => ({
      entry: {
        command: result.command,
        source: 'llm' as const,
        shellType: '',
        profileId: '',
        timestamp: Date.now(),
        count: 1,
      },
      matchType,
      confidence: result.confidence,
      description: result.description,
    }))
  }
}
