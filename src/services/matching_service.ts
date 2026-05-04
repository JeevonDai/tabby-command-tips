/** 命令匹配服务：提供前缀匹配和模糊匹配，从历史记录中筛选候选命令。 */

import { Injectable } from '@angular/core'

import { HistoryEntry, CommandTipsConfig } from '../models'

/** 单条匹配结果，包含命中的历史条目及其匹配类型。 */
export interface MatchResult {
  entry: HistoryEntry
  matchType: 'prefix' | 'fuzzy'
}

/** 命令匹配引擎，根据用户输入从前缀和模糊两个维度筛选历史命令。 */
@Injectable()
export class MatchingService {
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
}
