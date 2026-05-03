import { HistoryService } from '../src/services/history.service'
import { HistoryEntry } from '../src/models'

const mockConfigService = {
  store: {} as any,
  save: jasmine.createSpy('save'),
  changed$: { subscribe: () => ({ unsubscribe: () => {} }) },
}
const mockLogService = {
  create: () => ({
    warn: () => {},
    info: () => {},
    debug: () => {},
  }),
}

describe('HistoryService', () => {
  let service: HistoryService

  beforeEach(() => {
    mockConfigService.store = {}
    mockConfigService.save.calls.reset()
    service = new HistoryService(mockConfigService as any, mockLogService as any)
  })

  describe('mergeEntries', () => {
    it('应合并两个来源的条目并按 command+profileId 去重', () => {
      const shellEntries: HistoryEntry[] = [
        { command: 'git status', source: 'shell', shellType: 'bash', profileId: 'p1', timestamp: 1000, count: 3 },
        { command: 'ls -la', source: 'shell', shellType: 'bash', profileId: 'p1', timestamp: 2000, count: 1 },
      ]
      const tabbyEntries: HistoryEntry[] = [
        { command: 'git status', source: 'tabby', shellType: 'bash', profileId: 'p1', timestamp: 3000, count: 5 },
        { command: 'cd /tmp', source: 'tabby', shellType: 'bash', profileId: 'p1', timestamp: 4000, count: 2 },
      ]
      const merged = service.mergeEntries(shellEntries, tabbyEntries)
      expect(merged.length).toBe(3)
      const gitStatus = merged.find(e => e.command === 'git status')!
      expect(gitStatus.timestamp).toBe(3000)
      expect(gitStatus.count).toBe(8)
    })

    it('不同 profileId 的相同命令不应合并', () => {
      const shellEntries: HistoryEntry[] = [
        { command: 'git status', source: 'shell', shellType: 'bash', profileId: 'p1', timestamp: 1000, count: 1 },
      ]
      const tabbyEntries: HistoryEntry[] = [
        { command: 'git status', source: 'tabby', shellType: 'bash', profileId: 'p2', timestamp: 2000, count: 1 },
      ]
      const merged = service.mergeEntries(shellEntries, tabbyEntries)
      expect(merged.length).toBe(2)
    })
  })

  describe('parseBashHistory', () => {
    it('应逐行解析 bash 历史', () => {
      const content = 'git status\ngit commit -m "test"\nls -la\n'
      const entries = service.parseBashHistory(content, 'bash', 'default')
      expect(entries.length).toBe(3)
      expect(entries[0].command).toBe('git status')
      expect(entries[1].command).toBe('git commit -m "test"')
    })

    it('应跳过空行', () => {
      const content = 'git status\n\n\nls -la\n'
      const entries = service.parseBashHistory(content, 'bash', 'default')
      expect(entries.length).toBe(2)
    })
  })

  describe('parseZshHistory', () => {
    it('应解析带时间戳的 zsh 历史', () => {
      const content = ': 1609459200:0;git status\n: 1609459300:0;ls -la\n'
      const entries = service.parseZshHistory(content, 'zsh', 'default')
      expect(entries.length).toBe(2)
      expect(entries[0].command).toBe('git status')
      expect(entries[0].timestamp).toBe(1609459200000)
    })

    it('应处理不带时间戳的行', () => {
      const content = 'git status\n: 1609459300:0;ls -la\n'
      const entries = service.parseZshHistory(content, 'zsh', 'default')
      expect(entries.length).toBe(2)
      expect(entries[0].command).toBe('git status')
    })
  })

  describe('parseFishHistory', () => {
    it('应解析 fish 的键值对格式', () => {
      const content = '- cmd: git status\n  when: 1609459200\n- cmd: ls -la\n  when: 1609459300\n'
      const entries = service.parseFishHistory(content, 'fish', 'default')
      expect(entries.length).toBe(2)
      expect(entries[0].command).toBe('git status')
      expect(entries[0].timestamp).toBe(1609459200000)
    })
  })

  describe('parsePowerShellHistory', () => {
    it('应逐行解析 PowerShell 历史', () => {
      const content = 'Get-Process\nGet-ChildItem\n'
      const entries = service.parsePowerShellHistory(content, 'powershell', 'default')
      expect(entries.length).toBe(2)
      expect(entries[0].command).toBe('Get-Process')
    })
  })

  describe('recordCommand', () => {
    it('应记录新命令', () => {
      service.recordCommand('git status', 'default', 'bash')
      const entries = service.getTabbyEntries('default')
      expect(entries.length).toBe(1)
      expect(entries[0].command).toBe('git status')
      expect(entries[0].count).toBe(1)
    })

    it('重复命令应增加 count', () => {
      service.recordCommand('git status', 'default', 'bash')
      service.recordCommand('git status', 'default', 'bash')
      const entries = service.getTabbyEntries('default')
      expect(entries.length).toBe(1)
      expect(entries[0].count).toBe(2)
    })

    it('不同 profileId 应独立记录', () => {
      service.recordCommand('git status', 'p1', 'bash')
      service.recordCommand('git status', 'p2', 'bash')
      expect(service.getTabbyEntries('p1').length).toBe(1)
      expect(service.getTabbyEntries('p2').length).toBe(1)
    })
  })

  describe('clearProfile', () => {
    it('应清空指定 profile 的 Tabby 历史', () => {
      service.recordCommand('git status', 'p1', 'bash')
      service.recordCommand('ls -la', 'p2', 'bash')
      service.clearProfile('p1')
      expect(service.getTabbyEntries('p1').length).toBe(0)
      expect(service.getTabbyEntries('p2').length).toBe(1)
    })
  })
})
