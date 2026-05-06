# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

tabby-command-tips 是一个 Tabby 终端插件，根据用户输入实时匹配历史命令并以下拉列表展示。数据来源包括 Shell 历史文件（Bash/Zsh/Fish/PowerShell）和 Tabby 自身记录，支持前缀优先 + 模糊兜底的匹配策略，按最近使用 + 频率加权的热度算法排序。

## Commands

```bash
# 构编译（webpack → dist/index.js）
npm run build

# 监听模式，文件变更自动重编译
npm run watch

# 运行全部测试
npm run test

# 发布前自动构建（prepublishOnly 钩子）
npm run prepublishOnly
```

## Testing

- **框架**: Jasmine + ts-node，直接运行 TypeScript 测试文件，无需预编译
- **配置**: `jasmine.json`，测试文件位于 `tests/**/*.spec.ts`
- **Mock 体系**:
  - `tests/mocks/tabby-core.ts` — mock `Logger`、`LogService`、`ConfigService`
  - `tests/mocks/angular-core.ts` — mock `@angular/core` 的 `Injectable` 装饰器
- **新增测试**: 在 `tests/` 下创建 `*_service.spec.ts` 文件，导入 mock 模块而非真实 Tabby/Angular 依赖

## Project Structure

插件开发依据文档：https://docs.tabby.sh/ 
```
src/
├── index.ts                          # NgModule 入口，注册所有服务和 Provider
├── models.ts                         # HistoryEntry、CommandTipsConfig 数据结构与默认值
├── providers/
│   ├── config_provider.ts            # Tabby ConfigProvider 实现（配置项定义）
│   ├── hotkey_provider.ts            # Tabby HotkeyProvider 实现（快捷键定义）
│   └── settings_tab_provider.ts      # Tabby SettingsTabProvider 实现
├── services/
│   ├── matching_service.ts           # 前缀 + 模糊双层匹配算法
│   ├── scoring_service.ts            # 热度排序（指数衰减 + log2 频率）
│   ├── history_service.ts            # Shell 历史解析、Tabby 记录、合并去重、持久化
│   ├── shell_detector_service.ts     # 从环境变量/进程名检测 Shell 类型
│   └── llm_service.ts                # LLM 增强匹配服务
├── decorators/
│   └── terminal_decorator.ts         # 核心入口，监听输入 → 匹配 → DOM 渲染下拉列表
├── components/
│   ├── dropdown_component.ts         # 下拉列表 UI 组件（当前未使用，逻辑在 decorator 中）
│   ├── dropdown_component.pug
│   └── dropdown_component.scss
└── settings/
    ├── settings_tab_component.ts     # 设置页面组件
    ├── settings_tab_component.pug
    └── settings_tab_component.scss

tests/
├── mocks/
│   ├── tabby-core.ts                 # Tabby 核心服务 mock
│   └── angular-core.ts               # Angular 装饰器 mock
├── matching_service.spec.ts
├── scoring_service.spec.ts
├── history_service.spec.ts
└── shell_detector_service.spec.ts
```

### 核心数据流

```
用户输入字符 → TerminalDecorator.attach() 监听 tab.input$
    → 逐字符累积 currentInput（过滤终端转义序列）
    → RxJS: debounceTime(300ms) → filter(len >= 2)
    → MatchingService.execute() 前缀+模糊
    → ScoringService.sortWithLimit() 热度排序
    → 下拉列表 DOM 渲染
    → 用户选择 → session.write() 注入命令
```

**转义序列处理**：终端方向键发送转义序列（如 `\x1b[D` 表示左方向键），`onInput` 使用状态机过滤这些序列，防止 `[D` 等字符被添加到输入缓冲区。

**ESC 键优先级**：ESC 键只要下拉列表显示就能关闭，不依赖匹配结果是否为空。

## Code Style

**无分号、单引号、2 空格缩进**。

```typescript
// 文件顶部：模块级 JSDoc 描述
/** 命令匹配服务：提供前缀匹配和模糊匹配，从历史记录中筛选候选命令。 */

import { Injectable } from '@angular/core'
import { HistoryEntry } from '../models'

// 接口定义
export interface MatchResult {
  entry: HistoryEntry
  matchType: 'prefix' | 'fuzzy'
}

// 类级 JSDoc
/** 命令匹配引擎 */
@Injectable()
export class MatchingService {
  // 公开方法带 JSDoc
  /** 前缀匹配：筛选出以用户输入开头的历史命令。 */
  public prefixMatch (input: string, entries: HistoryEntry[]): MatchResult[] {
    if (!input) return []
    const lower = input.toLowerCase()
    return entries
      .filter(e => e.command.toLowerCase().startsWith(lower))
      .map(entry => ({ entry, matchType: 'prefix' as const }))
  }
}
```

**要点**:
- 装饰器与类之间无空行
- 方法参数括号前有空格：`method (param: Type)`
- 使用 `as const` 断言字面量类型
- 常量使用 UPPER_SNAKE_CASE：`const STORAGE_KEY = 'commandTipsHistory'`
- 文件名 snake_case，类名 PascalCase
- 中文 JSDoc 注释，简洁描述职责

## Git Workflow

**提交规范**: Conventional Commits 格式，使用中文描述

```
feat: 新功能描述
fix: 修复描述
```

**分支策略**:
- `main` — 主分支
- `master` — 当前开发分支（含进行中的重构）

**提交粒度**: 每个 commit 对应一个逻辑完整的变更单元（一个服务、一个功能模块或一个修复）。

## Boundaries

### 不要修改的内容

- **`node_modules/`** — 第三方依赖，不直接编辑
- **Tabby 核心包** — `tabby-core`、`tabby-terminal`、`tabby-settings` 是外部依赖，只通过其公开 API 使用
- **Angular 框架代码** — 不修改 Angular 模块生命周期或 DI 机制本身

### 外部依赖边界

Webpack 将以下包标记为 externals，运行时由 Tabby 宿主提供，构建时不打包：
- `@angular/*`、`@ng-bootstrap/*`
- `rxjs`
- `tabby-core`、`tabby-terminal`、`tabby-settings`
- `ngx-toastr`、`fs`

### 新增模块时的注册

新增服务需在 `src/index.ts` 的 `@NgModule.providers` 中注册。新增 Tabby Provider 需使用 `{ provide: XxxProvider, useClass: YourClass, multi: true }` 模式。

### 配置存储

插件配置存储在 `configService.store.commandTips` 下，Tabby 历史数据存储在 `commandTipsHistory` 键下。读写时需兼容 Tabby 的多种 ConfigService 内部实现（`_store`、`__getValue`、`__setValue`）。
