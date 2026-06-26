import { CommandTipsTerminalDecorator } from '../src/decorators/terminal_decorator'
import { DEFAULT_CONFIG } from '../src/models'

describe('CommandTipsTerminalDecorator', () => {
  let decorator: CommandTipsTerminalDecorator
  let decoratorAny: any
  let historyService: any
  let tab: any

  beforeEach(() => {
    const configService = {
      store: { commandTips: DEFAULT_CONFIG },
      changed$: { subscribe: () => ({ unsubscribe: () => {} }) },
      save: () => {},
    }
    const matchingService = {
      execute: () => [],
      executeWithLlm: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      isSubsequence: () => false,
    }
    const scoringService = {
      invalidateCache: () => {},
      sortWithLimit: (results: any[]) => results,
    }
    const shellDetector = {
      detect: () => ({ type: 'bash', historyFile: null }),
    }
    historyService = {
      setCurrentProfileId: () => {},
      recordCommand: jasmine.createSpy('recordCommand'),
      parseHistoryContent: () => [],
      getTabbyEntries: () => [],
      mergeEntries: () => [],
      setTabbyEntries: () => {},
      dispose: () => {},
    }
    const llmService = {
      setConfig: () => {},
      isAvailable: () => false,
    }
    const i18n = {
      t: (key: string) => key,
    }
    const log = {
      create: () => ({
        warn: () => {},
        info: () => {},
        debug: () => {},
      }),
    }

    decorator = new CommandTipsTerminalDecorator(
      configService as any,
      matchingService as any,
      scoringService as any,
      shellDetector as any,
      historyService,
      llmService as any,
      log as any,
      i18n as any,
    )
    decoratorAny = decorator as any

    tab = {}
    decoratorAny.activeTab = tab
    decoratorAny.tabProfiles.set(tab, 'default')
    decoratorAny.tabShellTypes.set(tab, 'bash')
    decoratorAny.currentProfileId = 'default'
    decoratorAny.currentShellType = 'bash'
    decoratorAny.triggerMatch = () => {}
    decoratorAny.hideDropdown = () => {}
  })

  it('不应把没有手动 Enter 的 CR/LF 识别为命令', () => {
    decoratorAny.onInput(tab, Buffer.from('telnet banner\r\n'))

    expect(historyService.recordCommand).not.toHaveBeenCalled()
    expect(decoratorAny.currentInput).toBe('')
  })

  it('应记录手动 Enter 提交的命令', () => {
    decoratorAny.currentInput = 'git status'
    decoratorAny.onKeyDown({
      key: 'Enter',
      isComposing: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent)
    decoratorAny.onInput(tab, Buffer.from('\r'))

    expect(historyService.recordCommand).toHaveBeenCalledOnceWith('git status', 'default', 'bash')
    expect(decoratorAny.currentInput).toBe('')
  })

  it('\\r\\n 对手动 Enter 只应记录一次命令', () => {
    decoratorAny.currentInput = 'brdinfo'
    decoratorAny.onKeyDown({
      key: 'Enter',
      isComposing: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent)
    decoratorAny.onInput(tab, Buffer.from('\r\n'))

    expect(historyService.recordCommand).toHaveBeenCalledTimes(1)
    expect(historyService.recordCommand).toHaveBeenCalledWith('brdinfo', 'default', 'bash')
  })

  it('telnet 设备输出行不应被误记为命令', () => {
    const telnetTab = { profile: { type: 'telnet' } }
    decoratorAny.activeTab = telnetTab
    decoratorAny.tabProfiles.set(telnetTab, 'default')

    // 设备输出中的 CR/LF 没有对应的手动 Enter，不应写入历史
    decoratorAny.onInput(telnetTab, Buffer.from('00> BRD TYPE: 0x80\r\n'))
    expect(historyService.recordCommand).not.toHaveBeenCalled()

    // 用户输入 brdinfo 并提交
    decoratorAny.currentInput = 'brdinfo'
    decoratorAny.onKeyDown({
      key: 'Enter',
      isComposing: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent)
    decoratorAny.onInput(telnetTab, Buffer.from('\r'))

    expect(historyService.recordCommand).toHaveBeenCalledOnceWith('brdinfo', 'default', 'bash')
  })

  it('Enter 快照应优先于随后被污染的 currentInput', () => {
    decoratorAny.currentInput = 'brdinfo'
    decoratorAny.onKeyDown({
      key: 'Enter',
      isComposing: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent)
    // 模拟 sync 或设备回显在 \\r 到达前污染了输入缓冲
    decoratorAny.currentInput = 'BRD TYPE: 0x80'
    decoratorAny.onInput(tab, Buffer.from('\r'))

    expect(historyService.recordCommand).toHaveBeenCalledOnceWith('brdinfo', 'default', 'bash')
  })

  it('配置提示符正则后 telnet 会话应能从缓冲区同步嵌入式 Shell 命令', () => {
    const telnetTab = {
      profile: { type: 'telnet' },
      frontend: {
        xterm: {
          buffer: {
            active: {
              cursorY: 0,
              getLine: () => ({
                translateToString: () => 'Shell > brdinfo',
              }),
            },
          },
        },
      },
    }
    decoratorAny.activeTab = telnetTab
    decoratorAny.tabProfiles.set(telnetTab, 'default')
    decoratorAny.currentProfileId = 'default'
    decoratorAny.config.profiles = [{
      id: 'default',
      name: 'Default',
      pattern: '',
      promptPatterns: '^(?:Shell >|core\\[\\d+\\]->)\\s+(.*)$',
    }]

    decoratorAny.syncInputFromOutput(telnetTab)
    expect(decoratorAny.currentInput).toBe('brdinfo')
  })

  it('Tab 应按配置补全第一条候选命令', () => {
    const session = { write: jasmine.createSpy('write') }
    tab.session = session
    decoratorAny.currentInput = 'gi'
    decoratorAny.dropdownVisible = true
    decoratorAny.currentSuggestions = [{
      entry: {
        command: 'git status',
        source: 'tabby',
        shellType: 'bash',
        profileId: 'default',
        timestamp: 0,
        count: 1,
      },
      matchType: 'prefix',
    }]

    decoratorAny.onKeyDown({
      key: 'Tab',
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as any as KeyboardEvent)

    expect(session.write).toHaveBeenCalledOnceWith(Buffer.from('t status'))
    expect(decoratorAny.currentInput).toBe('git status')
  })

  it('选中 Enter 直接换行选项时不应补全候选命令', () => {
    const session = { write: jasmine.createSpy('write') }
    tab.session = session
    decoratorAny.currentInput = 'git status'
    decoratorAny.dropdownVisible = true
    decoratorAny.currentSuggestions = [{
      entry: {
        command: 'git status --short',
        source: 'tabby',
        shellType: 'bash',
        profileId: 'default',
        timestamp: 0,
        count: 1,
      },
      matchType: 'prefix',
    }]
    decoratorAny.selectedIndex = 1

    decoratorAny.onKeyDown({
      key: 'Enter',
      isComposing: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as any as KeyboardEvent)

    expect(session.write).toHaveBeenCalledOnceWith(Buffer.from('\r'))
    expect(historyService.recordCommand).toHaveBeenCalledOnceWith('git status', 'default', 'bash')
    expect(decoratorAny.currentInput).toBe('')
  })
})
