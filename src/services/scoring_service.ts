/** 命令评分服务：综合使用频率和最近使用时间对匹配结果排序。 */

import { Injectable } from '@angular/core'

import { HistoryEntry, CommandTipsConfig } from '../models'
import { MatchResult } from './matching_service'

/** 评分权重配置，控制时间衰减和使用频率各自的影响力。 */
interface ScoringWeights {
  recencyWeight: number
  frequencyWeight: number
  halfLifeDays: number,
}

/** 命令评分服务，基于指数衰减和对数频率计算综合得分。 */
@Injectable()
export class ScoringService {
  /** 计算单条命令的综合得分，综合考虑使用频率和最近使用时间。 */
  public computeScore (entry: HistoryEntry, weights: ScoringWeights): number {
    const now = Date.now()
    const halfLifeMs = weights.halfLifeDays * 86400000
    const elapsed = now - entry.timestamp

    // 指数衰减：e^(-(now - lastUsed) / halfLife)
    const recencyScore = Math.exp(-elapsed / halfLifeMs)

    // 对数频率：log2(count + 1)，归一化到 0-1 范围（假设最大 1000 次）
    const frequencyScore = Math.log2(entry.count + 1) / Math.log2(1001)

    return weights.recencyWeight * recencyScore + weights.frequencyWeight * frequencyScore
  }

  /** 按综合得分降序排列匹配结果。 */
  public sort (results: MatchResult[], weights: ScoringWeights): MatchResult[] {
    return [...results].sort((a, b) => {
      const scoreA = this.computeScore(a.entry, weights)
      const scoreB = this.computeScore(b.entry, weights)
      return scoreB - scoreA
    })
  }

  /** 按综合得分降序排列并截取前 N 条结果。 */
  public sortWithLimit (results: MatchResult[], weights: ScoringWeights, limit: number): MatchResult[] {
    return this.sort(results, weights).slice(0, limit)
  }
}
