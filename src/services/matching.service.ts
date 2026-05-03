import { Injectable } from '@angular/core'
import { HistoryEntry, CommandTipsConfig } from '../models'

export interface MatchResult {
  entry: HistoryEntry
  matchType: 'prefix' | 'fuzzy'
}

@Injectable({ providedIn: 'root' })
export class MatchingService {
  prefixMatch (input: string, entries: HistoryEntry[]): MatchResult[] {
    if (!input) return []
    const lower = input.toLowerCase()
    return entries
      .filter(e => e.command.toLowerCase().startsWith(lower))
      .map(entry => ({ entry, matchType: 'prefix' as const }))
  }

  fuzzyMatch (input: string, entries: HistoryEntry[], exclude?: Set<string>): MatchResult[] {
    if (!input) return []
    const lower = input.toLowerCase()
    return entries
      .filter(e => {
        if (exclude?.has(e.command)) return false
        return this.isSubsequence(lower, e.command.toLowerCase())
      })
      .map(entry => ({ entry, matchType: 'fuzzy' as const }))
  }

  execute (
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

  private isSubsequence (input: string, target: string): boolean {
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
