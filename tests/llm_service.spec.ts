/** LlmService 单元测试 */

import '../tests/mocks/angular-core'
import '../tests/mocks/tabby-core'

import { LlmService } from '../src/services/llm_service'
import { LlmConfig, LlmContext, LlmErrorType, DEFAULT_LLM_CONFIG } from '../src/models'

describe('LlmService', () => {
  let service: LlmService

  beforeEach(() => {
    service = new LlmService()
  })

  describe('setConfig', () => {
    it('should set config correctly', () => {
      const config: LlmConfig = {
        ...DEFAULT_LLM_CONFIG,
        enabled: true,
        apiKey: 'test-key',
      }
      service.setConfig(config)
      expect(service.isAvailable()).toBe(true)
    })
  })

  describe('isAvailable', () => {
    it('should return false when config is not set', () => {
      expect(service.isAvailable()).toBe(false)
    })

    it('should return false when disabled', () => {
      service.setConfig({ ...DEFAULT_LLM_CONFIG, enabled: false, apiKey: 'test' })
      expect(service.isAvailable()).toBe(false)
    })

    it('should return false when apiKey is empty', () => {
      service.setConfig({ ...DEFAULT_LLM_CONFIG, enabled: true, apiKey: '' })
      expect(service.isAvailable()).toBe(false)
    })

    it('should return true when enabled and apiKey is set', () => {
      service.setConfig({ ...DEFAULT_LLM_CONFIG, enabled: true, apiKey: 'test-key' })
      expect(service.isAvailable()).toBe(true)
    })
  })

  describe('complete', () => {
    it('should return empty array when not available', async () => {
      const context: LlmContext = {
        currentDirectory: '/home/user',
        recentCommands: ['ls', 'cd'],
        shellType: 'bash',
        currentUser: 'user',
      }
      const result = await service.complete('gi', context)
      expect(result).toEqual([])
    })
  })

  describe('suggest', () => {
    it('should return empty array when not available', async () => {
      const context: LlmContext = {
        currentDirectory: '/home/user',
        recentCommands: ['ls', 'cd'],
        shellType: 'bash',
        currentUser: 'user',
      }
      const result = await service.suggest('', context)
      expect(result).toEqual([])
    })
  })

  describe('callWithRetry', () => {
    it('should retry on retryable errors', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        if (attempts < 3) {
          throw { type: LlmErrorType.NETWORK_ERROR, message: 'Network error', retryable: true }
        }
        return [{ command: 'test', matchType: 'completion' as const, confidence: 1 }]
      }

      const result = await service.callWithRetry(fn)
      expect(result.length).toBe(1)
      expect(attempts).toBe(3)
    })

    it('should not retry on non-retryable errors', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        throw { type: LlmErrorType.AUTH_ERROR, message: 'Auth error', retryable: false }
      }

      await expectAsync(service.callWithRetry(fn)).toBeRejected()
      expect(attempts).toBe(1)
    })

    it('should stop after max retries', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        throw { type: LlmErrorType.TIMEOUT, message: 'Timeout', retryable: true }
      }

      await expectAsync(service.callWithRetry(fn)).toBeRejected()
      expect(attempts).toBe(3)
    })
  })
})