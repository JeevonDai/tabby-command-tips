import { Injectable } from '@angular/core'
import { HistoryEntry, CommandTipsConfig } from '../models'
import { MatchResult } from './matching.service'

interface ScoringWeights {
  recencyWeight: number
  frequencyWeight: number
  halfLifeDays: number
}

@Injectable({ providedIn: 'root' })
export class ScoringService {
  computeScore (entry: HistoryEntry, weights: ScoringWeights): number {
    const now = Date.now()
    const halfLifeMs = weights.halfLifeDays * 86400000
    const elapsed = now - entry.timestamp

    // 指数衰减：e^(-(now - lastUsed) / halfLife)
    const recencyScore = Math.exp(-elapsed / halfLifeMs)

    // 对数频率：log2(count + 1)，归一化到 0-1 范围（假设最大 1000 次）
    const frequencyScore = Math.log2(entry.count + 1) / Math.log2(1001)

    return weights.recencyWeight * recencyScore + weights.frequencyWeight * frequencyScore
  }

  sort (results: MatchResult[], weights: ScoringWeights): MatchResult[] {
    return [...results].sort((a, b) => {
      const scoreA = this.computeScore(a.entry, weights)
      const scoreB = this.computeScore(b.entry, weights)
      return scoreB - scoreA
    })
  }

  sortWithLimit (results: MatchResult[], weights: ScoringWeights, limit: number): MatchResult[] {
    return this.sort(results, weights).slice(0, limit)
  }
}
