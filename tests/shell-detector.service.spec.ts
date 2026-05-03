import { ShellDetectorService, ShellInfo } from '../src/services/shell-detector.service'

// Mock LogService for tests
const mockLogService = {
  create: () => ({
    warn: () => {},
    info: () => {},
    debug: () => {},
  }),
}

describe('ShellDetectorService', () => {
  let service: ShellDetectorService

  beforeEach(() => {
    service = new ShellDetectorService(mockLogService as any)
  })

  describe('detectFromEnv', () => {
    it('应从 SHELL 环境变量检测 bash', () => {
      const result = service.detectFromEnv({ SHELL: '/bin/bash' })
      expect(result.type).toBe('bash')
      expect(result.historyFile).toContain('.bash_history')
    })

    it('应从 SHELL 环境变量检测 zsh', () => {
      const result = service.detectFromEnv({ SHELL: '/usr/bin/zsh' })
      expect(result.type).toBe('zsh')
      expect(result.historyFile).toContain('.zsh_history')
    })

    it('应从 SHELL 环境变量检测 fish', () => {
      const result = service.detectFromEnv({ SHELL: '/usr/local/bin/fish' })
      expect(result.type).toBe('fish')
      expect(result.historyFile).toContain('fish_history')
    })

    it('应检测 pwsh (PowerShell Core)', () => {
      const result = service.detectFromEnv({ SHELL: '/usr/bin/pwsh' })
      expect(result.type).toBe('powershell')
    })

    it('SHELL 不存在时应返回 unknown', () => {
      const result = service.detectFromEnv({})
      expect(result.type).toBe('unknown')
    })
  })

  describe('detectFromProcessName', () => {
    it('应从进程名检测 bash', () => {
      const result = service.detectFromProcessName('bash')
      expect(result.type).toBe('bash')
    })

    it('应从进程名检测 zsh', () => {
      const result = service.detectFromProcessName('zsh')
      expect(result.type).toBe('zsh')
    })

    it('应从带 .exe 后缀的进程名检测 powershell', () => {
      const result = service.detectFromProcessName('pwsh.exe')
      expect(result.type).toBe('powershell')
    })

    it('未知进程名应返回 unknown', () => {
      const result = service.detectFromProcessName('something-else')
      expect(result.type).toBe('unknown')
    })
  })

  describe('detect', () => {
    it('优先使用 SHELL 环境变量', () => {
      const result = service.detect(
        { SHELL: '/bin/zsh' },
        'bash'
      )
      expect(result.type).toBe('zsh')
    })

    it('SHELL 不存在时回退到进程名', () => {
      const result = service.detect({}, 'fish')
      expect(result.type).toBe('fish')
    })

    it('都不存在时返回 unknown', () => {
      const result = service.detect({}, 'something')
      expect(result.type).toBe('unknown')
    })
  })
})
