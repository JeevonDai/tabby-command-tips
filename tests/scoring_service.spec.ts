// ScoringService 的单元测试，验证基于时效性和使用频率的评分与排序逻辑
import { ScoringService } from '../src/services/scoring_service'
import { MatchResult } from '../src/services/matching_service'
import { HistoryEntry } from '../src/models'

function makeEntry(command: string, timestamp: number, count: number): HistoryEntry {
  return {
    command,
    source: 'tabby',
    shellType: 'bash',
    profileId: 'default',
    timestamp,
    count,
  }
}

function makeResult(entry: HistoryEntry, matchType: 'prefix' | 'fuzzy' = 'prefix'): MatchResult {
  return { entry, matchType }
}

describe('ScoringService', () => {
  let service: ScoringService
  const now = Date.now()
  const DAY = 86400000

  beforeEach(() => {
    service = new ScoringService()
  })

  describe('computeScore', () => {
    it('最近使用的命令应有更高的 recencyScore', () => {
      const recent = makeEntry('git status', now, 5)
      const old = makeEntry('git commit', now - 30 * DAY, 5)
      const recentScore = service.computeScore(recent, { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 })
      const oldScore = service.computeScore(old, { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 })
      expect(recentScore).toBeGreaterThan(oldScore)
    })

    it('使用次数更多的命令应有更高的 frequencyScore', () => {
      const frequent = makeEntry('git status', now, 100)
      const rare = makeEntry('git commit', now, 1)
      const freqScore = service.computeScore(frequent, { recencyWeight: 0.5, frequencyWeight: 0.5, halfLifeDays: 7 })
      const rareScore = service.computeScore(rare, { recencyWeight: 0.5, frequencyWeight: 0.5, halfLifeDays: 7 })
      expect(freqScore).toBeGreaterThan(rareScore)
    })

    it('权重为 0 时应忽略对应因素', () => {
      const entry = makeEntry('git status', now, 10)
      const scoreRecencyOnly = service.computeScore(entry, { recencyWeight: 1, frequencyWeight: 0, halfLifeDays: 7 })
      const scoreFrequencyOnly = service.computeScore(entry, { recencyWeight: 0, frequencyWeight: 1, halfLifeDays: 7 })
      expect(scoreRecencyOnly).not.toEqual(scoreFrequencyOnly)
    })
  })

  describe('sort', () => {
    it('应按分数降序排列', () => {
      const results = [
        makeResult(makeEntry('git commit', now - 7 * DAY, 2)),
        makeResult(makeEntry('git status', now, 10)),
        makeResult(makeEntry('git push', now - 3 * DAY, 5)),
      ]
      const sorted = service.sort(results, { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 })
      expect(sorted[0].entry.command).toBe('git status')
    })

    it('空数组应返回空数组', () => {
      const sorted = service.sort([], { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 })
      expect(sorted.length).toBe(0)
    })

    it('单个元素应原样返回', () => {
      const results = [makeResult(makeEntry('git status', now, 5))]
      const sorted = service.sort(results, { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 })
      expect(sorted.length).toBe(1)
      expect(sorted[0].entry.command).toBe('git status')
    })
  })

  describe('sortWithLimit', () => {
    it('应限制返回数量', () => {
      const results = Array.from({ length: 50 }, (_, i) =>
        makeResult(makeEntry(`cmd${i}`, now - i * DAY, i))
      )
      const sorted = service.sortWithLimit(results, { recencyWeight: 0.7, frequencyWeight: 0.3, halfLifeDays: 7 }, 10)
      expect(sorted.length).toBe(10)
    })
  })
})
