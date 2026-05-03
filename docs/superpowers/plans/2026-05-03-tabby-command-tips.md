# Tabby 命令历史提示插件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Tabby 终端构建一个命令历史提示插件，根据用户实时输入以前缀优先 + 模糊兜底的方式匹配历史命令，以下拉列表形式展示，支持热度排序、键盘/鼠标交互、多 Shell 自动检测和持久化存储。

**Architecture:** 分层模块化架构。TerminalDecorator 监听终端输入 → MatchingService 执行前缀+模糊匹配 → ScoringService 按热度排序 → DropdownComponent 渲染下拉列表。HistoryService 管理 Shell 历史文件读取和 Tabby 持久化数据的合并。ShellDetectorService 自动检测当前会话的 shell 类型。

**Tech Stack:** TypeScript, Angular 12, RxJS 7, ng-bootstrap, Pug, SCSS, Webpack 5, Tabby Plugin API (tabby-core, tabby-terminal, tabby-settings)

---

## 文件结构

```
tabby_command_tips/
├── package.json
├── tsconfig.json
├── webpack.config.js
├── src/
│   ├── index.ts                          # Angular 模块入口，注册所有 provider
│   ├── models.ts                         # 共享数据模型 (HistoryEntry, CommandTipsConfig)
│   ├── providers/
│   │   ├── configProvider.ts             # 配置定义与默认值
│   │   └── hotkeyProvider.ts             # 快捷键定义
│   ├── services/
│   │   ├── shell-detector.service.ts     # Shell 类型检测
│   │   ├── history.service.ts            # 历史命令数据管理
│   │   ├── matching.service.ts           # 前缀+模糊匹配算法
│   │   └── scoring.service.ts            # 热度排序算法
│   ├── decorators/
│   │   └── terminal-decorator.ts         # 终端装饰器，监听输入并触发匹配
│   ├── components/
│   │   ├── dropdown.component.ts         # 下拉列表组件
│   │   ├── dropdown.component.pug        # 下拉列表模板
│   │   └── dropdown.component.scss       # 下拉列表样式
│   └── settings/
│       ├── settingsTab.component.ts      # 设置页面组件
│       ├── settingsTab.component.pug     # 设置页面模板
│       └── settingsTab.component.scss    # 设置页面样式
└── tests/
    ├── matching.service.spec.ts          # 匹配算法测试
    ├── scoring.service.spec.ts           # 排序算法测试
    ├── shell-detector.service.spec.ts    # Shell 检测测试
    └── history.service.spec.ts           # 历史数据管理测试
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `webpack.config.js`
- Create: `src/index.ts` (占位模块)
- Create: `src/models.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "tabby-command-tips",
  "version": "1.0.0",
  "description": "Tabby 终端命令历史提示插件，根据输入实时匹配历史命令并以下拉列表展示",
  "main": "dist/index.js",
  "typings": "dist/index.d.ts",
  "keywords": ["tabby-plugin"],
  "author": "",
  "license": "MIT",
  "scripts": {
    "build": "webpack --progress --color",
    "watch": "webpack --progress --color --watch",
    "test": "ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "@angular/animations": "^12.0.0",
    "@angular/common": "^12.0.0",
    "@angular/core": "^12.0.0",
    "@angular/forms": "^12.0.0",
    "@angular/platform-browser": "^12.0.0",
    "@ng-bootstrap/ng-bootstrap": "^2.2.0",
    "@types/webpack-env": "^1.16.0",
    "@types/jasmine": "^3.10.0",
    "apply-loader": "^2.0.0",
    "css-loader": "^5.2.0",
    "jasmine": "^3.10.0",
    "node-sass": "^5.0.0",
    "pug": "^2.0.3",
    "pug-loader": "^2.4.0",
    "rxjs": "^7.3.0",
    "sass-loader": "^11.0.0",
    "style-loader": "^2.0.0",
    "tabby-core": "^1.0.156",
    "tabby-settings": "^1.0.156",
    "tabby-terminal": "^1.0.156",
    "ts-loader": "^9.2.0",
    "ts-node": "^10.4.0",
    "typescript": "^4.2.3",
    "webpack": "^5.24.4",
    "webpack-cli": "^4.5.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建 webpack.config.js**

```javascript
const path = require('path')

module.exports = {
  target: 'electron-renderer',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js', '.pug', '.scss'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.pug$/,
        use: ['apply-loader', 'pug-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  externals: {
    'tabby-core': 'tabby-core',
    'tabby-settings': 'tabby-settings',
    'tabby-terminal': 'tabby-terminal',
  },
}
```

- [ ] **Step 4: 创建共享数据模型 src/models.ts**

```typescript
export interface HistoryEntry {
  command: string
  source: 'shell' | 'tabby'
  shellType: string
  profileId: string
  timestamp: number
  count: number
}

export interface CommandTipsConfig {
  enabled: boolean
  minChars: number
  debounceMs: number
  maxResults: number
  scoring: {
    recencyWeight: number
    frequencyWeight: number
    halfLifeDays: number
  }
  matching: 'prefix-fuzzy' | 'prefix-only' | 'fuzzy-only'
  showSourceTag: boolean
  tabCompletesFirst: boolean
}

export const DEFAULT_CONFIG: CommandTipsConfig = {
  enabled: true,
  minChars: 2,
  debounceMs: 300,
  maxResults: 20,
  scoring: {
    recencyWeight: 0.7,
    frequencyWeight: 0.3,
    halfLifeDays: 7,
  },
  matching: 'prefix-fuzzy',
  showSourceTag: false,
  tabCompletesFirst: true,
}
```

- [ ] **Step 5: 创建 jasmine.json 测试配置**

```json
{
  "spec_dir": "tests",
  "spec_files": ["**/*.spec.ts"],
  "helpers": [],
  "env": {
    "stopSpecOnExpectationFailure": false,
    "random": false
  }
}
```

- [ ] **Step 6: 创建占位入口 src/index.ts**

```typescript
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule } from 'tabby-core'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  providers: [],
})
export default class CommandTipsModule {}
```

- [ ] **Step 7: 初始化 git 并提交**

```bash
cd "C:/Users/MuWinds/Documents/Coding Project/github/tabby_command_tips"
git init
git add package.json tsconfig.json webpack.config.js jasmine.json src/index.ts src/models.ts
git commit -m "feat: 项目脚手架，package.json/tsconfig/webpack/jasmine/models"
```

---

### Task 2: 配置提供者 (ConfigProvider)

**Files:**
- Create: `src/providers/configProvider.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: 创建配置提供者 src/providers/configProvider.ts**

```typescript
import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'
import { DEFAULT_CONFIG } from '../models'

@Injectable()
export class CommandTipsConfigProvider extends ConfigProvider {
  defaults = {
    commandTips: { ...DEFAULT_CONFIG },
  }

  constructor () {
    super()
  }
}
```

- [ ] **Step 2: 在 index.ts 中注册 ConfigProvider**

替换 `src/index.ts` 的全部内容：

```typescript
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider } from 'tabby-core'
import { CommandTipsConfigProvider } from './providers/configProvider'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
  ],
})
export default class CommandTipsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add src/providers/configProvider.ts src/index.ts
git commit -m "feat: 添加 ConfigProvider，默认配置项"
```

---

### Task 3: Shell 检测服务 (ShellDetectorService)

**Files:**
- Create: `src/services/shell-detector.service.ts`
- Create: `tests/shell-detector.service.spec.ts`

- [ ] **Step 1: 编写 Shell 检测测试 tests/shell-detector.service.spec.ts**

```typescript
import { ShellDetectorService, ShellInfo } from '../src/services/shell-detector.service'

describe('ShellDetectorService', () => {
  let service: ShellDetectorService

  beforeEach(() => {
    service = new ShellDetectorService()
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
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：FAIL — `Cannot find module '../src/services/shell-detector.service'`

- [ ] **Step 3: 创建 ShellDetectorService src/services/shell-detector.service.ts**

```typescript
import { Injectable } from '@angular/core'
import { LogService, Logger } from 'tabby-core'

export interface ShellInfo {
  type: 'bash' | 'zsh' | 'fish' | 'powershell' | 'unknown'
  historyFile: string | null
}

const SHELL_MAP: Record<string, { type: ShellInfo['type']; historyFile: string }> = {
  bash: {
    type: 'bash',
    historyFile: '~/.bash_history',
  },
  zsh: {
    type: 'zsh',
    historyFile: '~/.zsh_history',
  },
  fish: {
    type: 'fish',
    historyFile: '~/.local/share/fish/fish_history',
  },
  pwsh: {
    type: 'powershell',
    historyFile: '~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt',
  },
  powershell: {
    type: 'powershell',
    historyFile: '~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt',
  },
}

@Injectable({ providedIn: 'root' })
export class ShellDetectorService {
  private logger: Logger

  constructor (private log: LogService) {
    this.logger = log.create('command-tips')
  }

  detectFromEnv (env: Record<string, string>): ShellInfo {
    const shellPath = env.SHELL
    if (!shellPath) {
      return { type: 'unknown', historyFile: null }
    }
    return this.matchShellFromPath(shellPath)
  }

  detectFromProcessName (processName: string): ShellInfo {
    const clean = processName.replace(/\.exe$/i, '').toLowerCase()
    if (SHELL_MAP[clean]) {
      return { ...SHELL_MAP[clean] }
    }
    // 模糊匹配：进程名包含 shell 名
    for (const [key, value] of Object.entries(SHELL_MAP)) {
      if (clean.includes(key)) {
        return { ...value }
      }
    }
    return { type: 'unknown', historyFile: null }
  }

  detect (env: Record<string, string>, processName: string): ShellInfo {
    const fromEnv = this.detectFromEnv(env)
    if (fromEnv.type !== 'unknown') {
      return fromEnv
    }
    return this.detectFromProcessName(processName)
  }

  private matchShellFromPath (shellPath: string): ShellInfo {
    const parts = shellPath.split('/')
    const basename = parts[parts.length - 1].toLowerCase()
    if (SHELL_MAP[basename]) {
      return { ...SHELL_MAP[basename] }
    }
    return { type: 'unknown', historyFile: null }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/shell-detector.service.ts tests/shell-detector.service.spec.ts
git commit -m "feat: ShellDetectorService，自动检测 shell 类型和历史文件路径"
```

---

### Task 4: 匹配服务 (MatchingService)

**Files:**
- Create: `src/services/matching.service.ts`
- Create: `tests/matching.service.spec.ts`

- [ ] **Step 1: 编写匹配算法测试 tests/matching.service.spec.ts**

```typescript
import { MatchingService, MatchResult } from '../src/services/matching.service'
import { HistoryEntry } from '../src/models'

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

  beforeEach(() => {
    service = new MatchingService()
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
      const results = service.fuzzyMatch('gco', entries)
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
      // 确认没有重复
      expect(new Set(commands).size).toBe(commands.length)
    })
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：FAIL — `Cannot find module '../src/services/matching.service'`

- [ ] **Step 3: 创建 MatchingService src/services/matching.service.ts**

```typescript
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

    // prefix-fuzzy: 前缀优先，模糊兜底
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
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matching.service.ts tests/matching.service.spec.ts
git commit -m "feat: MatchingService，前缀+模糊双层匹配算法"
```

---

### Task 5: 排序服务 (ScoringService)

**Files:**
- Create: `src/services/scoring.service.ts`
- Create: `tests/scoring.service.spec.ts`

- [ ] **Step 1: 编写排序算法测试 tests/scoring.service.spec.ts**

```typescript
import { ScoringService } from '../src/services/scoring.service'
import { MatchResult } from '../src/services/matching.service'
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
      // 两个分数不应相等（除非巧合）
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
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：FAIL — `Cannot find module '../src/services/scoring.service'`

- [ ] **Step 3: 创建 ScoringService src/services/scoring.service.ts**

```typescript
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
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/scoring.service.ts tests/scoring.service.spec.ts
git commit -m "feat: ScoringService，热度排序算法（时间衰减+频率加权）"
```

---

### Task 6: 历史数据管理服务 (HistoryService)

**Files:**
- Create: `src/services/history.service.ts`
- Create: `tests/history.service.spec.ts`

- [ ] **Step 1: 编写历史数据管理测试 tests/history.service.spec.ts**

```typescript
import { HistoryService } from '../src/services/history.service'
import { HistoryEntry } from '../src/models'

// Mock ConfigService 和 LogService
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
      // git status 应保留更近的 timestamp 和累加的 count
      const gitStatus = merged.find(e => e.command === 'git status')!
      expect(gitStatus.timestamp).toBe(3000)
      expect(gitStatus.count).toBe(8) // 3 + 5
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
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：FAIL — `Cannot find module '../src/services/history.service'`

- [ ] **Step 3: 创建 HistoryService src/services/history.service.ts**

```typescript
import { Injectable } from '@angular/core'
import { ConfigService, LogService, Logger } from 'tabby-core'
import { HistoryEntry } from '../models'

const STORAGE_KEY = 'commandTipsHistory'

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private logger: Logger
  // 内存中的 Tabby 历史，按 profileId 分组
  private tabbyHistory: Map<string, HistoryEntry[]> = new Map()

  constructor (
    private configService: ConfigService,
    private log: LogService,
  ) {
    this.logger = log.create('command-tips')
    this.loadFromStorage()
  }

  private loadFromStorage (): void {
    try {
      const stored = this.configService.store[STORAGE_KEY]
      if (stored && typeof stored === 'object') {
        for (const [profileId, entries] of Object.entries(stored)) {
          this.tabbyHistory.set(profileId, entries as HistoryEntry[])
        }
      }
    } catch (err) {
      this.logger.warn('Failed to load history from storage:', err)
    }
  }

  private saveToStorage (): void {
    try {
      const obj: Record<string, HistoryEntry[]> = {}
      for (const [profileId, entries] of this.tabbyHistory) {
        obj[profileId] = entries
      }
      this.configService.store[STORAGE_KEY] = obj
      this.configService.save()
    } catch (err) {
      this.logger.warn('Failed to save history to storage:', err)
    }
  }

  mergeEntries (shellEntries: HistoryEntry[], tabbyEntries: HistoryEntry[]): HistoryEntry[] {
    const map = new Map<string, HistoryEntry>()

    for (const entry of shellEntries) {
      const key = `${entry.command}||${entry.profileId}`
      map.set(key, { ...entry })
    }

    for (const entry of tabbyEntries) {
      const key = `${entry.command}||${entry.profileId}`
      const existing = map.get(key)
      if (existing) {
        existing.timestamp = Math.max(existing.timestamp, entry.timestamp)
        existing.count += entry.count
        existing.source = 'tabby' // 优先标记为 tabby 来源
      } else {
        map.set(key, { ...entry })
      }
    }

    return Array.from(map.values())
  }

  parseBashHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(command => ({
        command,
        source: 'shell' as const,
        shellType,
        profileId,
        timestamp: 0, // bash 历史无时间戳
        count: 1,
      }))
  }

  parseZshHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const match = line.match(/^: (\d+):\d+;(.+)$/)
        if (match) {
          return {
            command: match[2],
            source: 'shell' as const,
            shellType,
            profileId,
            timestamp: parseInt(match[1], 10) * 1000,
            count: 1,
          }
        }
        return {
          command: line,
          source: 'shell' as const,
          shellType,
          profileId,
          timestamp: 0,
          count: 1,
        }
      })
  }

  parseFishHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const lines = content.split('\n')
    let currentCmd: string | null = null
    let currentWhen = 0

    for (const line of lines) {
      const cmdMatch = line.match(/^- cmd: (.+)$/)
      const whenMatch = line.match(/^  when: (\d+)$/)

      if (cmdMatch) {
        currentCmd = cmdMatch[1]
      } else if (whenMatch && currentCmd) {
        currentWhen = parseInt(whenMatch[1], 10)
        entries.push({
          command: currentCmd,
          source: 'shell',
          shellType,
          profileId,
          timestamp: currentWhen * 1000,
          count: 1,
        })
        currentCmd = null
        currentWhen = 0
      }
    }

    return entries
  }

  parsePowerShellHistory (content: string, shellType: string, profileId: string): HistoryEntry[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(command => ({
        command,
        source: 'shell' as const,
        shellType,
        profileId,
        timestamp: 0,
        count: 1,
      }))
  }

  parseHistoryContent (content: string, shellType: string, profileId: string): HistoryEntry[] {
    switch (shellType) {
      case 'zsh':
        return this.parseZshHistory(content, shellType, profileId)
      case 'fish':
        return this.parseFishHistory(content, shellType, profileId)
      case 'powershell':
        return this.parsePowerShellHistory(content, shellType, profileId)
      default:
        return this.parseBashHistory(content, shellType, profileId)
    }
  }

  recordCommand (command: string, profileId: string, shellType: string): void {
    if (!command.trim()) return

    let entries = this.tabbyHistory.get(profileId) || []
    const existing = entries.find(e => e.command === command)

    if (existing) {
      existing.count++
      existing.timestamp = Date.now()
    } else {
      entries.push({
        command,
        source: 'tabby',
        shellType,
        profileId,
        timestamp: Date.now(),
        count: 1,
      })
    }

    this.tabbyHistory.set(profileId, entries)
    this.saveToStorage()
  }

  getTabbyEntries (profileId: string): HistoryEntry[] {
    return this.tabbyHistory.get(profileId) || []
  }

  clearProfile (profileId: string): void {
    this.tabbyHistory.set(profileId, [])
    this.saveToStorage()
  }

  setTabbyEntries (profileId: string, entries: HistoryEntry[]): void {
    this.tabbyHistory.set(profileId, entries)
    this.saveToStorage()
  }

  getProfileCount (profileId: string): number {
    return (this.tabbyHistory.get(profileId) || []).length
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/history.service.ts tests/history.service.spec.ts
git commit -m "feat: HistoryService，Shell 历史解析、Tabby 历史记录、合并去重"
```

---

### Task 7: 快捷键提供者 (HotkeyProvider)

**Files:**
- Create: `src/providers/hotkeyProvider.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: 创建 HotkeyProvider src/providers/hotkeyProvider.ts**

```typescript
import { Injectable } from '@angular/core'
import { HotkeyProvider, Command } from 'tabby-core'

@Injectable()
export class CommandTipsHotkeyProvider extends HotkeyProvider {
  async provide (): Promise<Command[]> {
    return [
      {
        id: 'command-tips.toggle',
        name: '打开/关闭命令历史提示',
        icon: 'fas fa-history',
        defaultHotkey: 'Ctrl+Shift+P',
      },
      {
        id: 'command-tips.clear-profile',
        name: '清空当前 profile 的 Tabby 历史',
        icon: 'fas fa-trash',
      },
    ]
  }
}
```

- [ ] **Step 2: 在 index.ts 中注册 HotkeyProvider**

```typescript
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider } from 'tabby-core'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
  ],
})
export default class CommandTipsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add src/providers/hotkeyProvider.ts src/index.ts
git commit -m "feat: HotkeyProvider，Ctrl+Shift+P 触发命令提示"
```

---

### Task 8: 下拉列表组件 (DropdownComponent)

**Files:**
- Create: `src/components/dropdown.component.ts`
- Create: `src/components/dropdown.component.pug`
- Create: `src/components/dropdown.component.scss`

- [ ] **Step 1: 创建下拉列表组件 TypeScript src/components/dropdown.component.ts**

```typescript
import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core'
import { MatchResult } from '../services/matching.service'

@Component({
  template: require('./dropdown.component.pug'),
  styles: [require('./dropdown.component.scss')],
})
export class DropdownComponent implements OnChanges {
  @Input() suggestions: MatchResult[] = []
  @Input() currentInput = ''
  @Input() showSourceTag = false
  @Input() visible = false

  @Output() selected = new EventEmitter<string>()
  @Output() cancelled = new EventEmitter<void>()
  @Output() tabPressed = new EventEmitter<void>()

  selectedIndex = 0

  @ViewChild('listContainer') listContainer: ElementRef | null = null

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.suggestions) {
      this.selectedIndex = 0
    }
  }

  moveUp (): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--
      this.scrollToSelected()
    }
  }

  moveDown (): void {
    if (this.selectedIndex < this.suggestions.length - 1) {
      this.selectedIndex++
      this.scrollToSelected()
    }
  }

  confirmSelected (): void {
    if (this.suggestions.length > 0) {
      this.selected.emit(this.suggestions[this.selectedIndex].entry.command)
    }
  }

  confirmTab (): void {
    this.tabPressed.emit()
  }

  cancel (): void {
    this.cancelled.emit()
  }

  onItemHover (index: number): void {
    this.selectedIndex = index
  }

  onItemClick (index: number): void {
    this.selectedIndex = index
    this.confirmSelected()
  }

  private scrollToSelected (): void {
    if (!this.listContainer) return
    const container = this.listContainer.nativeElement
    const item = container.children[this.selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }
}
```

- [ ] **Step 2: 创建下拉列表模板 src/components/dropdown.component.pug**

```pug
.command-tips-dropdown(*ngIf='visible && suggestions.length > 0')
  .command-tips-header
    span.command-tips-input-preview {{ currentInput }}
  .command-tips-list(#listContainer)
    .command-tips-item(
      *ngFor='let item of suggestions; let i = index',
      [class.selected]='i === selectedIndex',
      [class.fuzzy]='item.matchType === "fuzzy"',
      (mouseenter)='onItemHover(i)',
      (click)='onItemClick(i)'
    )
      span.command-tips-match-type(*ngIf='item.matchType === "prefix"') P
      span.command-tips-match-type.fuzzy-badge(*ngIf='item.matchType === "fuzzy"') F
      span.command-tips-command {{ item.entry.command }}
      span.command-tips-source(*ngIf='showSourceTag') {{ item.entry.source }}
  .command-tips-footer
    span ↑↓ 选择
    span Enter 确认
    span Tab 补全
    span Esc 取消
```

- [ ] **Step 3: 创建下拉列表样式 src/components/dropdown.component.scss**

```scss
.command-tips-dropdown {
  position: absolute;
  z-index: 1000;
  min-width: 300px;
  max-width: 600px;
  max-height: 340px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: var(--theme-bg);
  border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
  font-family: var(--theme-font, monospace);
  font-size: 13px;
  color: var(--theme-fg);
}

.command-tips-header {
  padding: 6px 10px;
  border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
  background: var(--theme-bg-secondary, rgba(255, 255, 255, 0.03));

  .command-tips-input-preview {
    color: var(--theme-fg-muted, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }
}

.command-tips-list {
  max-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
}

.command-tips-item {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover,
  &.selected {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-bg, #1e1e1e);
  }

  &.fuzzy {
    opacity: 0.8;
  }
}

.command-tips-match-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  background: rgba(76, 175, 80, 0.3);
  color: #4caf50;
  flex-shrink: 0;

  &.fuzzy-badge {
    background: rgba(255, 193, 7, 0.3);
    color: #ffc107;
  }
}

.command-tips-command {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-tips-source {
  font-size: 10px;
  color: var(--theme-fg-muted, rgba(255, 255, 255, 0.4));
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.command-tips-footer {
  display: flex;
  gap: 12px;
  padding: 4px 10px;
  border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
  background: var(--theme-bg-secondary, rgba(255, 255, 255, 0.03));
  font-size: 11px;
  color: var(--theme-fg-muted, rgba(255, 255, 255, 0.4));
}
```

- [ ] **Step 4: 提交**

```bash
git add src/components/dropdown.component.ts src/components/dropdown.component.pug src/components/dropdown.component.scss
git commit -m "feat: DropdownComponent，下拉列表 UI 组件（键盘+鼠标交互）"
```

---

### Task 9: 终端装饰器 (TerminalDecorator)

**Files:**
- Create: `src/decorators/terminal-decorator.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: 创建终端装饰器 src/decorators/terminal-decorator.ts**

```typescript
import { Injectable, ComponentRef, Injector } from '@angular/core'
import { Subscription } from 'rxjs'
import { filter, debounceTime, bufferTime, map } from 'rxjs/operators'
import { ConfigService, AppService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { MatchingService, MatchResult } from '../services/matching.service'
import { ScoringService } from '../services/scoring.service'
import { ShellDetectorService } from '../services/shell-detector.service'
import { HistoryService } from '../services/history.service'
import { DropdownComponent } from '../components/dropdown.component'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

@Injectable()
export class CommandTipsTerminalDecorator extends TerminalDecorator {
  private subscriptions: Subscription[] = []
  private currentInput = ''
  private dropdownRef: ComponentRef<DropdownComponent> | null = null
  private dropdownVisible = false
  private config: CommandTipsConfig = DEFAULT_CONFIG
  private currentProfileId = ''
  private currentShellType = 'bash'

  constructor (
    private matchingService: MatchingService,
    private scoringService: ScoringService,
    private shellDetector: ShellDetectorService,
    private historyService: HistoryService,
    private configService: ConfigService,
    private injector: Injector,
  ) {
    super()
    this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    this.configService.changed$.subscribe(() => {
      this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    })
  }

  attach (tab: BaseTerminalTabComponent): void {
    // 监听 session 变化
    const sessionSub = tab.sessionChanged$.subscribe(session => {
      if (!session) return
      this.onSessionChanged(tab, session)
    })
    this.subscriptions.push(sessionSub)

    // 如果已有 session，立即附加
    if (tab.session) {
      this.onSessionChanged(tab, tab.session)
    }
  }

  private onSessionChanged (tab: BaseTerminalTabComponent, session: any): void {
    // 检测 shell 类型
    const env = session.environment || {}
    const processName = session.processName || ''
    const shellInfo = this.shellDetector.detect(env, processName)
    this.currentShellType = shellInfo.type !== 'unknown' ? shellInfo.type : 'bash'

    // 获取 profileId
    this.currentProfileId = tab.profile?.id || 'default'

    // 读取 shell 历史文件
    this.loadShellHistory(shellInfo.historyFile)

    // 监听输入
    const inputSub = tab.input$.subscribe(data => {
      this.onInput(tab, session, data)
    })
    this.subscriptions.push(inputSub)
  }

  private loadShellHistory (historyFile: string | null): void {
    if (!historyFile || historyFile === '~/.bash_history' && this.currentShellType === 'unknown') return
    // Shell 历史文件读取需要通过 Node.js fs 模块
    // 在 Electron 环境中可用
    try {
      const fs = require('fs')
      const os = require('os')
      const path = require('path')
      const expandedPath = historyFile.replace(/^~/, os.homedir())
      if (fs.existsSync(expandedPath)) {
        const content = fs.readFileSync(expandedPath, 'utf-8')
        const shellEntries = this.historyService.parseHistoryContent(
          content, this.currentShellType, this.currentProfileId
        )
        const tabbyEntries = this.historyService.getTabbyEntries(this.currentProfileId)
        // 合并结果存储在 historyService 中
        const merged = this.historyService.mergeEntries(shellEntries, tabbyEntries)
        this.historyService.setTabbyEntries(this.currentProfileId, merged)
      }
    } catch (err) {
      // 文件读取失败，静默忽略
    }
  }

  private onInput (tab: BaseTerminalTabComponent, session: any, data: Buffer): void {
    const str = data.toString()

    for (const char of str) {
      if (char === '\r' || char === '\n') {
        // 回车：记录命令并清空缓冲区
        if (this.currentInput.trim()) {
          this.historyService.recordCommand(this.currentInput.trim(), this.currentProfileId, this.currentShellType)
        }
        this.currentInput = ''
        this.hideDropdown()
      } else if (char === '\x7f') {
        // 退格
        this.currentInput = this.currentInput.slice(0, -1)
        this.triggerMatch()
      } else if (char === '\x03') {
        // Ctrl+C
        this.currentInput = ''
        this.hideDropdown()
      } else if (char >= ' ') {
        // 可打印字符
        this.currentInput += char
        this.triggerMatch()
      }
    }
  }

  private matchDebounceTimer: any = null

  private triggerMatch (): void {
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    this.matchDebounceTimer = setTimeout(() => {
      this.executeMatch()
    }, this.config.debounceMs)
  }

  private executeMatch (): void {
    if (!this.config.enabled) return
    if (this.currentInput.length < this.config.minChars) {
      this.hideDropdown()
      return
    }

    const allEntries = this.historyService.getTabbyEntries(this.currentProfileId)
    const matchResults = this.matchingService.execute(this.currentInput, allEntries, this.config.matching)

    if (matchResults.length === 0) {
      this.hideDropdown()
      return
    }

    const sortedResults = this.scoringService.sortWithLimit(
      matchResults,
      this.config.scoring,
      this.config.maxResults,
    )

    this.showDropdown(sortedResults)
  }

  private showDropdown (suggestions: MatchResult[]): void {
    if (this.dropdownRef) {
      this.dropdownRef.instance.suggestions = suggestions
      this.dropdownRef.instance.currentInput = this.currentInput
      this.dropdownRef.instance.showSourceTag = this.config.showSourceTag
      this.dropdownRef.instance.visible = true
      this.dropdownRef.instance.ngOnChanges({ suggestions: {} } as any)
    }
    this.dropdownVisible = true
  }

  private hideDropdown (): void {
    if (this.dropdownRef) {
      this.dropdownRef.instance.visible = false
    }
    this.dropdownVisible = false
  }

  private injectCommand (session: any, command: string): void {
    // 清除当前输入（发送退格）
    const backspaces = Buffer.alloc(this.currentInput.length, '\x7f')
    session.write(backspaces)
    // 写入选中的命令
    session.write(Buffer.from(command))
    this.currentInput = command
    this.hideDropdown()
  }
}
```

- [ ] **Step 2: 在 index.ts 中注册 TerminalDecorator 和 DropdownComponent**

```typescript
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider } from 'tabby-core'
import { TerminalDecorator } from 'tabby-terminal'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'
import { CommandTipsTerminalDecorator } from './decorators/terminal-decorator'
import { DropdownComponent } from './components/dropdown.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
  ],
  declarations: [
    DropdownComponent,
  ],
  entryComponents: [
    DropdownComponent,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
    { provide: TerminalDecorator, useClass: CommandTipsTerminalDecorator, multi: true },
  ],
})
export default class CommandTipsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add src/decorators/terminal-decorator.ts src/index.ts
git commit -m "feat: TerminalDecorator，监听终端输入并触发匹配流程"
```

---

### Task 10: 下拉列表与装饰器集成（键盘事件拦截 + 命令注入）

**Files:**
- Modify: `src/decorators/terminal-decorator.ts`
- Modify: `src/components/dropdown.component.ts`

- [ ] **Step 1: 完善 TerminalDecorator 的下拉列表动态创建和键盘拦截**

在 `src/decorators/terminal-decorator.ts` 中，添加动态创建组件和键盘事件拦截的完整逻辑。替换整个文件：

```typescript
import { Injectable, ComponentRef, Injector, ViewContainerRef } from '@angular/core'
import { Subscription, Subject } from 'rxjs'
import { filter, debounceTime } from 'rxjs/operators'
import { ConfigService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { MatchingService, MatchResult } from '../services/matching.service'
import { ScoringService } from '../services/scoring.service'
import { ShellDetectorService } from '../services/shell-detector.service'
import { HistoryService } from '../services/history.service'
import { DropdownComponent } from '../components/dropdown.component'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

@Injectable()
export class CommandTipsTerminalDecorator extends TerminalDecorator {
  private subscriptions: Subscription[] = []
  private currentInput = ''
  private dropdownRef: ComponentRef<DropdownComponent> | null = null
  private dropdownVisible = false
  private config: CommandTipsConfig = DEFAULT_CONFIG
  private currentProfileId = ''
  private currentShellType = 'bash'
  private matchDebounceTimer: any = null
  private commandSelected$ = new Subject<string>()
  private commandCancelled$ = new Subject<void>()

  constructor (
    private matchingService: MatchingService,
    private scoringService: ScoringService,
    private shellDetector: ShellDetectorService,
    private historyService: HistoryService,
    private configService: ConfigService,
    private injector: Injector,
  ) {
    super()
    this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    this.configService.changed$.subscribe(() => {
      this.config = this.configService.store.commandTips || DEFAULT_CONFIG
    })
  }

  attach (tab: BaseTerminalTabComponent): void {
    // 动态创建下拉列表组件
    this.createDropdown(tab)

    // 监听 session 变化
    const sessionSub = tab.sessionChanged$.subscribe(session => {
      if (!session) return
      this.onSessionChanged(tab, session)
    })
    this.subscriptions.push(sessionSub)

    if (tab.session) {
      this.onSessionChanged(tab, tab.session)
    }
  }

  private createDropdown (tab: BaseTerminalTabComponent): void {
    // 使用 tab 的 viewContainerRef 动态创建组件
    const container = tab.viewContainerRef || (tab as any)._viewContainerRef
    if (!container) return

    this.dropdownRef = container.createComponent(DropdownComponent, { injector: this.injector })

    // 订阅组件事件
    this.dropdownRef.instance.selected.subscribe((command: string) => {
      this.injectCommand(tab.session, command)
    })
    this.dropdownRef.instance.cancelled.subscribe(() => {
      this.hideDropdown()
    })
    this.dropdownRef.instance.tabPressed.subscribe(() => {
      if (this.dropdownRef && this.dropdownRef.instance.suggestions.length > 0) {
        const firstCommand = this.dropdownRef.instance.suggestions[0].entry.command
        this.injectCommand(tab.session, firstCommand)
      }
    })

    // 将组件 DOM 插入到终端 tab 的宿主元素中
    const hostEl = tab.elementRef?.nativeElement || (tab as any).element?.nativeElement
    if (hostEl) {
      hostEl.style.position = 'relative'
      hostEl.appendChild(this.dropdownRef.location.nativeElement)
    }
  }

  private onSessionChanged (tab: BaseTerminalTabComponent, session: any): void {
    const env = session.environment || {}
    const processName = session.processName || ''
    const shellInfo = this.shellDetector.detect(env, processName)
    this.currentShellType = shellInfo.type !== 'unknown' ? shellInfo.type : 'bash'
    this.currentProfileId = tab.profile?.id || 'default'

    this.loadShellHistory(shellInfo.historyFile)

    const inputSub = tab.input$.subscribe(data => {
      this.onInput(tab, session, data)
    })
    this.subscriptions.push(inputSub)
  }

  private loadShellHistory (historyFile: string | null): void {
    if (!historyFile) return
    try {
      const fs = require('fs')
      const os = require('os')
      const expandedPath = historyFile.replace(/^~/, os.homedir())
      if (fs.existsSync(expandedPath)) {
        const content = fs.readFileSync(expandedPath, 'utf-8')
        const shellEntries = this.historyService.parseHistoryContent(
          content, this.currentShellType, this.currentProfileId
        )
        const tabbyEntries = this.historyService.getTabbyEntries(this.currentProfileId)
        const merged = this.historyService.mergeEntries(shellEntries, tabbyEntries)
        this.historyService.setTabbyEntries(this.currentProfileId, merged)
      }
    } catch (err) {
      // 静默忽略
    }
  }

  private onInput (tab: BaseTerminalTabComponent, session: any, data: Buffer): void {
    const str = data.toString()

    for (const char of str) {
      if (char === '\r' || char === '\n') {
        if (this.currentInput.trim()) {
          this.historyService.recordCommand(this.currentInput.trim(), this.currentProfileId, this.currentShellType)
        }
        this.currentInput = ''
        this.hideDropdown()
      } else if (char === '\x7f') {
        this.currentInput = this.currentInput.slice(0, -1)
        if (this.currentInput.length < this.config.minChars) {
          this.hideDropdown()
        } else {
          this.triggerMatch()
        }
      } else if (char === '\x03') {
        this.currentInput = ''
        this.hideDropdown()
      } else if (char === '\x1b') {
        // Esc 键序列开始，检查是否是方向键
        // 方向键由 DropdownComponent 的键盘事件处理
        // 这里不处理，让终端自己处理
      } else if (char >= ' ') {
        this.currentInput += char
        this.triggerMatch()
      }
    }
  }

  private triggerMatch (): void {
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    this.matchDebounceTimer = setTimeout(() => {
      this.executeMatch()
    }, this.config.debounceMs)
  }

  private executeMatch (): void {
    if (!this.config.enabled) return
    if (this.currentInput.length < this.config.minChars) {
      this.hideDropdown()
      return
    }

    const allEntries = this.historyService.getTabbyEntries(this.currentProfileId)
    const matchResults = this.matchingService.execute(this.currentInput, allEntries, this.config.matching)

    if (matchResults.length === 0) {
      this.hideDropdown()
      return
    }

    const sortedResults = this.scoringService.sortWithLimit(
      matchResults,
      this.config.scoring,
      this.config.maxResults,
    )

    this.showDropdown(sortedResults)
  }

  private showDropdown (suggestions: MatchResult[]): void {
    if (!this.dropdownRef) return
    const instance = this.dropdownRef.instance
    instance.suggestions = suggestions
    instance.currentInput = this.currentInput
    instance.showSourceTag = this.config.showSourceTag
    instance.visible = true
    instance.ngOnChanges({ suggestions: {} } as any)
    this.dropdownVisible = true
  }

  private hideDropdown (): void {
    if (!this.dropdownRef) return
    this.dropdownRef.instance.visible = false
    this.dropdownVisible = false
  }

  private injectCommand (session: any, command: string): void {
    if (!session) return
    // 清除当前输入（发送退格）
    const backspaces = Buffer.alloc(this.currentInput.length, '\x7f')
    session.write(backspaces)
    // 写入选中的命令
    session.write(Buffer.from(command))
    this.currentInput = command
    this.hideDropdown()
  }

  dispose (): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []
    if (this.matchDebounceTimer) {
      clearTimeout(this.matchDebounceTimer)
    }
    if (this.dropdownRef) {
      this.dropdownRef.destroy()
      this.dropdownRef = null
    }
  }
}
```

- [ ] **Step 2: 完善 DropdownComponent 的键盘事件处理**

在 `src/components/dropdown.component.ts` 中添加 `@HostListener` 处理键盘事件：

```typescript
import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges, HostListener } from '@angular/core'
import { MatchResult } from '../services/matching.service'

@Component({
  template: require('./dropdown.component.pug'),
  styles: [require('./dropdown.component.scss')],
})
export class DropdownComponent implements OnChanges {
  @Input() suggestions: MatchResult[] = []
  @Input() currentInput = ''
  @Input() showSourceTag = false
  @Input() visible = false

  @Output() selected = new EventEmitter<string>()
  @Output() cancelled = new EventEmitter<void>()
  @Output() tabPressed = new EventEmitter<void>()

  selectedIndex = 0

  @ViewChild('listContainer') listContainer: ElementRef | null = null

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.suggestions) {
      this.selectedIndex = 0
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown (event: KeyboardEvent): void {
    if (!this.visible || this.suggestions.length === 0) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        this.moveUp()
        break
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        this.moveDown()
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        this.confirmSelected()
        break
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        this.confirmTab()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        this.cancel()
        break
    }
  }

  moveUp (): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--
      this.scrollToSelected()
    }
  }

  moveDown (): void {
    if (this.selectedIndex < this.suggestions.length - 1) {
      this.selectedIndex++
      this.scrollToSelected()
    }
  }

  confirmSelected (): void {
    if (this.suggestions.length > 0) {
      this.selected.emit(this.suggestions[this.selectedIndex].entry.command)
    }
  }

  confirmTab (): void {
    this.tabPressed.emit()
  }

  cancel (): void {
    this.cancelled.emit()
  }

  onItemHover (index: number): void {
    this.selectedIndex = index
  }

  onItemClick (index: number): void {
    this.selectedIndex = index
    this.confirmSelected()
  }

  private scrollToSelected (): void {
    if (!this.listContainer) return
    const container = this.listContainer.nativeElement
    const item = container.children[this.selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/decorators/terminal-decorator.ts src/components/dropdown.component.ts
git commit -m "feat: 集成下拉列表动态创建、键盘事件拦截和命令注入"
```

---

### Task 11: 设置页面 (SettingsTabComponent)

**Files:**
- Create: `src/settings/settingsTab.component.ts`
- Create: `src/settings/settingsTab.component.pug`
- Create: `src/settings/settingsTab.component.scss`
- Create: `src/providers/settingsTabProvider.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: 创建设置页面组件 src/settings/settingsTab.component.ts**

```typescript
import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { HistoryService } from '../services/history.service'
import { CommandTipsConfig, DEFAULT_CONFIG } from '../models'

@Component({
  template: require('./settingsTab.component.pug'),
  styles: [require('./settingsTab.component.scss')],
})
export class SettingsTabComponent {
  config: CommandTipsConfig = DEFAULT_CONFIG

  constructor (
    private configService: ConfigService,
    private historyService: HistoryService,
  ) {
    this.config = this.configService.store.commandTips || { ...DEFAULT_CONFIG }
  }

  get profileHistoryCount (): number {
    // 使用当前活动的 profile
    const activeProfile = (this.configService.store as any).activeProfile || 'default'
    return this.historyService.getProfileCount(activeProfile)
  }

  save (): void {
    this.configService.store.commandTips = { ...this.config }
    this.configService.save()
  }

  clearHistory (): void {
    const activeProfile = (this.configService.store as any).activeProfile || 'default'
    this.historyService.clearProfile(activeProfile)
    this.configService.store.commandTips = { ...this.config }
    this.configService.save()
  }
}
```

- [ ] **Step 2: 创建设置页面模板 src/settings/settingsTab.component.pug**

```pug
h3 命令历史提示

.form-group
  .form-check
    input.form-check-input(type='checkbox', [(ngModel)]='config.enabled', (change)='save()')
    label.form-check-label 启用命令历史提示

.form-group
  label 触发设置
  .row
    .col-4
      label 最少字符数
      input.form-control(type='number', [(ngModel)]='config.minChars', (change)='save()', min='1', max='10')
    .col-4
      label 延迟触发 (ms)
      input.form-control(type='number', [(ngModel)]='config.debounceMs', (change)='save()', min='50', max='2000')
    .col-4
      label 最大显示数
      input.form-control(type='number', [(ngModel)]='config.maxResults', (change)='save()', min='1', max='100')

.form-group
  label 匹配模式
  select.form-control([(ngModel)]='config.matching', (change)='save()')
    option(value='prefix-fuzzy') 前缀优先 + 模糊兜底
    option(value='prefix-only') 仅前缀匹配
    option(value='fuzzy-only') 仅模糊匹配

.form-group
  label 排序权重
  .row
    .col-6
      label 时间权重: {{ config.scoring.recencyWeight.toFixed(2) }}
      input.form-control-range(type='range', [(ngModel)]='config.scoring.recencyWeight', (change)='save()', min='0', max='1', step='0.05')
    .col-6
      label 频率权重: {{ config.scoring.frequencyWeight.toFixed(2) }}
      input.form-control-range(type='range', [(ngModel)]='config.scoring.frequencyWeight', (change)='save()', min='0', max='1', step='0.05')

.form-group
  label 半衰期 (天)
  input.form-control(type='number', [(ngModel)]='config.scoring.halfLifeDays', (change)='save()', min='1', max='365', style='width: 120px')

.form-group
  .form-check
    input.form-check-input(type='checkbox', [(ngModel)]='config.showSourceTag', (change)='save()')
    label.form-check-label 显示来源标签 (shell / tabby)

.form-group
  .form-check
    input.form-check-input(type='checkbox', [(ngModel)]='config.tabCompletesFirst', (change)='save()')
    label.form-check-label Tab 键补全第一项

hr

.form-group
  label 数据管理
  p 当前 profile 历史条数: {{ profileHistoryCount }}
  button.btn.btn-danger((click)='clearHistory()') 清空当前 profile 历史
```

- [ ] **Step 3: 创建设置页面样式 src/settings/settingsTab.component.scss**

```scss
:host {
  display: block;
  padding: 20px;
  max-width: 600px;
}

h3 {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

label {
  font-weight: 500;
  margin-bottom: 4px;
}

.form-control-range {
  width: 100%;
}

.btn-danger {
  margin-top: 8px;
}
```

- [ ] **Step 4: 创建设置标签页提供者 src/providers/settingsTabProvider.ts**

```typescript
import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { SettingsTabComponent } from '../settings/settingsTab.component'

@Injectable()
export class CommandTipsSettingsTabProvider extends SettingsTabProvider {
  async getTabs () {
    return [{
      type: 'component',
      title: '命令历史提示',
      icon: 'fas fa-history',
      component: SettingsTabComponent,
    }]
  }
}
```

- [ ] **Step 5: 在 index.ts 中注册设置页面**

```typescript
import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'
import { TerminalDecorator } from 'tabby-terminal'
import { CommandTipsConfigProvider } from './providers/configProvider'
import { CommandTipsHotkeyProvider } from './providers/hotkeyProvider'
import { CommandTipsSettingsTabProvider } from './providers/settingsTabProvider'
import { CommandTipsTerminalDecorator } from './decorators/terminal-decorator'
import { DropdownComponent } from './components/dropdown.component'
import { SettingsTabComponent } from './settings/settingsTab.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    TabbyCoreModule,
  ],
  declarations: [
    DropdownComponent,
    SettingsTabComponent,
  ],
  entryComponents: [
    DropdownComponent,
    SettingsTabComponent,
  ],
  providers: [
    { provide: ConfigProvider, useClass: CommandTipsConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: CommandTipsHotkeyProvider, multi: true },
    { provide: SettingsTabProvider, useClass: CommandTipsSettingsTabProvider, multi: true },
    { provide: TerminalDecorator, useClass: CommandTipsTerminalDecorator, multi: true },
  ],
})
export default class CommandTipsModule {}
```

- [ ] **Step 6: 提交**

```bash
git add src/settings/ src/providers/settingsTabProvider.ts src/index.ts
git commit -m "feat: 设置页面，配置触发/匹配/排序/显示选项，支持清空历史"
```

---

### Task 12: 最终集成验证与构建测试

**Files:**
- Modify: 无（仅验证）

- [ ] **Step 1: 安装依赖**

```bash
cd "C:/Users/MuWinds/Documents/Coding Project/github/tabby_command_tips"
npm install
```

预期：依赖安装成功，无报错

- [ ] **Step 2: 运行单元测试**

```bash
npx ts-node node_modules/jasmine/bin/jasmine --config=jasmine.json
```

预期：所有测试通过

- [ ] **Step 3: 执行构建**

```bash
npm run build
```

预期：`dist/index.js` 生成成功，无编译错误

- [ ] **Step 4: 在 Tabby 中加载插件进行手动测试**

1. 打开 Tabby
2. 进入 Settings → Plugins
3. 点击 "Install from npm" 或手动指定本地路径
4. 重启 Tabby
5. 打开一个终端 tab
6. 输入 `git` 等常见命令前缀，验证下拉列表是否出现
7. 测试键盘上下选择、Enter 确认、Tab 补全、Esc 取消
8. 测试鼠标点击选择
9. 进入 Settings → 命令历史提示，验证设置页面功能
10. 修改配置后验证行为变化

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: 插件完成，全部功能集成测试通过"
```
