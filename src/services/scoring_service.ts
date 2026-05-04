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

/** 缓存的评分条目。 */
interface CachedScore {
  score: number
  timestamp: number
}

/** 评分缓存有效期（毫秒）。 */
const SCORE_CACHE_TTL = 60000

/** 命令评分服务，基于指数衰减和对数频率计算综合得分。 */
@Injectable()
export class ScoringService {
  private scoreCache: Map<string, CachedScore> = new Map()
  private lastWeightsKey = ''

  /** 计算单条命令的综合得分，综合考虑使用频率和最近使用时间。 */
  public computeScore (entry: HistoryEntry, weights: ScoringWeights): number {
    const now = Date.now()
    const halfLifeMs = weights.halfLifeDays * 86400000
    const elapsed = now - entry.timestamp

    const recencyScore = Math.exp(-elapsed / halfLifeMs)
    const frequencyScore = Math.log2(entry.count + 1) / Math.log2(1001)

    return weights.recencyWeight * recencyScore + weights.frequencyWeight * frequencyScore
  }

  /** 从缓存获取或计算得分。 */
  private getCachedScore (entry: HistoryEntry, weights: ScoringWeights, weightsKey: string): number {
    const cacheKey = entry.command
    const cached = this.scoreCache.get(cacheKey)
    const now = Date.now()

    if (cached && cached.timestamp > now - SCORE_CACHE_TTL && this.lastWeightsKey === weightsKey) {
      return cached.score
    }

    const score = this.computeScore(entry, weights)
    this.scoreCache.set(cacheKey, { score, timestamp: now })
    return score
  }

  /** 生成权重配置的缓存键。 */
  private weightsKey (weights: ScoringWeights): string {
    return `${weights.recencyWeight}:${weights.frequencyWeight}:${weights.halfLifeDays}`
  }

  /** 按综合得分降序排列匹配结果。 */
  public sort (results: MatchResult[], weights: ScoringWeights): MatchResult[] {
    const wk = this.weightsKey(weights)
    this.lastWeightsKey = wk
    return [...results].sort((a, b) => {
      const scoreA = this.getCachedScore(a.entry, weights, wk)
      const scoreB = this.getCachedScore(b.entry, weights, wk)
      return scoreB - scoreA
    })
  }

  /** 按综合得分降序排列并截取前 N 条结果（使用最小堆 top-K，O(N log K)）。 */
  public sortWithLimit (results: MatchResult[], weights: ScoringWeights, limit: number): MatchResult[] {
    if (results.length <= limit) {
      return this.sort(results, weights)
    }

    const wk = this.weightsKey(weights)
    this.lastWeightsKey = wk

    // 最小堆，按得分排序
    const heap: Array<{ result: MatchResult, score: number }> = []

    for (const result of results) {
      const score = this.getCachedScore(result.entry, weights, wk)

      if (heap.length < limit) {
        heap.push({ result, score })
        this.siftUp(heap, heap.length - 1)
      } else if (score > heap[0].score) {
        heap[0] = { result, score }
        this.siftDown(heap, 0)
      }
    }

    // 堆中元素按得分降序输出
    const sorted: MatchResult[] = []
    while (heap.length > 0) {
      sorted.push(heap[0].result)
      const last = heap.pop()!
      if (heap.length > 0) {
        heap[0] = last
        this.siftDown(heap, 0)
      }
    }
    sorted.reverse()
    return sorted
  }

  private siftUp (heap: Array<{ result: MatchResult, score: number }>, idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1
      if (heap[idx].score < heap[parent].score) {
        const tmp = heap[idx]
        heap[idx] = heap[parent]
        heap[parent] = tmp
        idx = parent
      } else {
        break
      }
    }
  }

  private siftDown (heap: Array<{ result: MatchResult, score: number }>, idx: number): void {
    const len = heap.length
    while (true) {
      let smallest = idx
      const left = 2 * idx + 1
      const right = 2 * idx + 2
      if (left < len && heap[left].score < heap[smallest].score) {
        smallest = left
      }
      if (right < len && heap[right].score < heap[smallest].score) {
        smallest = right
      }
      if (smallest !== idx) {
        const tmp = heap[idx]
        heap[idx] = heap[smallest]
        heap[smallest] = tmp
        idx = smallest
      } else {
        break
      }
    }
  }

  /** 清空评分缓存（在权重配置变更时调用）。 */
  public invalidateCache (): void {
    this.scoreCache.clear()
  }
}
