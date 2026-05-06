// MatchingService 的单元测试，验证前缀匹配、模糊匹配及组合模式的正确性
import { MatchingService, MatchResult } from '../src/services/matching_service'
import { LlmService } from '../src/services/llm_service'
import { HistoryEntry, LlmContext, DEFAULT_LLM_CONFIG } from '../src/models'

function makeEntry(command: string, count = 1): HistoryEntry {
  return {
    command,
    source: 'shell',
    shellType: 'bash',
    profileId: 'default',
    timestamp: Date.now(),
    count,
  }
}

describe('MatchingService', () => {
  let service: MatchingService
  let llmService: LlmService

  beforeEach(() => {
    llmService = new LlmService()
    service = new MatchingService(llmService)
  })

  describe('prefixMatch', () => {
    it('应匹配以输入开头的命令', () => {
      const entries = [
        makeEntry('git status'),
        makeEntry('git commit'),
        makeEntry('ls -la'),
      ]
      const results = service.prefixMatch('git', entries)
      expect(results.length).toBe(2)
      expect(results[0].entry.command).toBe('git status')
      expect(results[1].entry.command).toBe('git commit')
    })

    it('匹配结果应标记为 prefix 类型', () => {
      const entries = [makeEntry('git status')]
      const results = service.prefixMatch('git', entries)
      expect(results[0].matchType).toBe('prefix')
    })

    it('无匹配时应返回空数组', () => {
      const entries = [makeEntry('ls -la')]
      const results = service.prefixMatch('git', entries)
      expect(results.length).toBe(0)
    })

    it('输入为空时应返回空数组', () => {
      const entries = [makeEntry('git status')]
      const results = service.prefixMatch('', entries)
      expect(results.length).toBe(0)
    })
  })

  describe('fuzzyMatch', () => {
    it('应匹配子序列', () => {
      const entries = [
        makeEntry('git checkout feature'),
        makeEntry('git commit'),
        makeEntry('ls -la'),
      ]
      const results = service.fuzzyMatch('gch', entries)
      expect(results.length).toBe(1)
      expect(results[0].entry.command).toBe('git checkout feature')
    })

    it('匹配结果应标记为 fuzzy 类型', () => {
      const entries = [makeEntry('git checkout')]
      const results = service.fuzzyMatch('gco', entries)
      expect(results[0].matchType).toBe('fuzzy')
    })

    it('字符顺序不一致时不应匹配', () => {
      const entries = [makeEntry('git checkout')]
      const results = service.fuzzyMatch('ogt', entries)
      expect(results.length).toBe(0)
    })

    it('输入为空时应返回空数组', () => {
      const entries = [makeEntry('git status')]
      const results = service.fuzzyMatch('', entries)
      expect(results.length).toBe(0)
    })
  })

  describe('execute', () => {
    it('prefix-fuzzy 模式应前缀匹配优先，模糊匹配兜底', () => {
      const entries = [
        makeEntry('git status'),
        makeEntry('git commit'),
        makeEntry('go test ./...'),
      ]
      const results = service.execute('gi', entries, 'prefix-fuzzy')
      expect(results.length).toBe(2)
      expect(results[0].matchType).toBe('prefix')
      expect(results[1].matchType).toBe('prefix')
    })

    it('prefix-only 模式应只返回前缀匹配', () => {
      const entries = [
        makeEntry('git status'),
        makeEntry('go test'),
      ]
      const results = service.execute('gi', entries, 'prefix-only')
      expect(results.length).toBe(1)
      expect(results[0].entry.command).toBe('git status')
    })

    it('fuzzy-only 模式应只返回模糊匹配', () => {
      const entries = [
        makeEntry('git status'),
        makeEntry('git commit'),
      ]
      const results = service.execute('gs', entries, 'fuzzy-only')
      expect(results.length).toBe(1)
      expect(results[0].entry.command).toBe('git status')
    })

    it('前缀匹配结果不应在模糊匹配中重复', () => {
      const entries = [
        makeEntry('git status'),
        makeEntry('git stash'),
      ]
      const results = service.execute('git s', entries, 'prefix-fuzzy')
      expect(results.length).toBe(2)
      const commands = results.map(r => r.entry.command)
      expect(commands).toContain('git status')
      expect(commands).toContain('git stash')
      expect(new Set(commands).size).toBe(commands.length)
    })
  })

  describe('executeWithLlm', () => {
    const llmContext: LlmContext = {
      currentDirectory: '/home/user',
      recentCommands: ['ls', 'cd'],
      shellType: 'bash',
      currentUser: 'user',
    }

    it('should return history results when LLM is not available', (done) => {
      const entries = [makeEntry('git status')]
      service.executeWithLlm('git', entries, 'prefix-fuzzy', llmContext).subscribe({
        next: (results) => {
          expect(results.length).toBe(1)
          expect(results[0].matchType).toBe('prefix')
          done()
        },
      })
    })

    it('should return empty array for empty input', (done) => {
      const entries = [makeEntry('git status')]
      service.executeWithLlm('', entries, 'prefix-fuzzy', llmContext).subscribe({
        next: (results) => {
          expect(results.length).toBe(0)
          done()
        },
      })
    })

    it('should merge LLM results when available', (done) => {
      // 设置 LLM 服务可用
      llmService.setConfig({
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        apiKey: 'test-key',
      })

      // Mock LLM 调用
      spyOn(llmService, 'complete').and.returnValue(
        Promise.resolve([{
          command: 'git log --oneline',
          description: 'Show compact history',
          matchType: 'completion' as const,
          confidence: 0.9,
        }])
      )

      const entries = [makeEntry('git status')]
      const results: MatchResult[][] = []

      service.executeWithLlm('git', entries, 'prefix-fuzzy', llmContext).subscribe({
        next: (result) => {
          results.push(result)
        },
        complete: () => {
          // 第一次是历史记录结果，第二次包含 LLM 结果
          expect(results.length).toBe(2)
          expect(results[0].length).toBe(1)
          expect(results[1].length).toBe(2)
          done()
        },
      })
    })
  })
})
