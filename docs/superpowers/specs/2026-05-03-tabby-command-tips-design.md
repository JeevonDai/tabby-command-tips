# Tabby 命令历史提示插件设计文档

## 概述

为 Tabby 终端开发一个命令历史提示插件，根据用户当前输入内容，实时以可交互下拉列表的形式展示匹配的历史命令。数据来源包括 Shell 历史文件和 Tabby 自身记录，支持前缀优先 + 模糊兜底的匹配策略，按最近使用 + 频率加权的热度算法排序。

## 需求总结

| 维度 | 选择 |
|------|------|
| 展示方式 | 下拉列表 |
| 数据来源 | Shell 历史文件 + Tabby 自身记录，合并去重 |
| 匹配策略 | 前缀优先 + 模糊兜底 |
| 触发时机 | 延迟（300ms）+ 最少字符（2） |
| 排序方式 | 最近使用 + 频率加权（热度算法） |
| 操作方式 | 键盘 + 鼠标 + Tab 快速补全 + 自定义快捷键 |
| UI 风格 | 跟随 Tabby 主题（ng-bootstrap） |
| Shell 支持 | 自动检测当前会话的 shell 类型 |
| 记录范围 | 持久化存储，按 profile 隔离 |

## 架构方案

采用**分层模块化**架构，按职责拆分为清晰的模块：

```
src/
├── index.ts                    # 入口，注册模块
├── providers/
│   ├── configProvider.ts       # 配置定义
│   └── hotkeyProvider.ts       # 快捷键定义
├── services/
│   ├── history.service.ts      # 历史命令数据管理（读取/写入/合并/持久化）
│   ├── shell-detector.service.ts # Shell 类型检测
│   ├── matching.service.ts     # 匹配算法（前缀+模糊）
│   └── scoring.service.ts      # 热度排序算法
├── components/
│   ├── dropdown.component.ts   # 下拉列表 UI 组件
│   └── dropdown.component.pug  # 下拉列表模板
├── decorators/
│   └── terminal-decorator.ts   # 终端装饰器，监听输入并触发展示
└── settings/
    ├── settingsTab.component.ts  # 设置页面
    └── settingsTab.component.pug
```

## 设计详情

### 1. 数据层

#### 1.1 Shell 类型检测（ShellDetectorService）

检测当前终端会话的 shell 类型，用于确定历史文件路径和格式。

**检测策略**（按优先级）：

1. 从 Tabby 的 `session.environment` 中读取 `SHELL` 环境变量
2. 检查进程名（如 `bash.exe`、`zsh`、`fish`、`pwsh`）
3. 如果检测失败，回退到系统默认 shell

**支持的 Shell 及历史文件**：

| Shell | 历史文件路径 | 格式 |
|-------|-------------|------|
| Bash | `~/.bash_history` | 每行一条命令 |
| Zsh | `~/.zsh_history` | 带时间戳的扩展格式 |
| Fish | `~/.local/share/fish/fish_history` | 键值对格式 |
| PowerShell | `~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt` | 每行一条命令 |

#### 1.2 历史命令管理（HistoryService）

**数据模型**：

```typescript
interface HistoryEntry {
  command: string          // 命令文本
  source: 'shell' | 'tabby'  // 来源
  shellType: string        // shell 类型
  profileId: string        // 归属的 profile
  timestamp: number        // 最后执行时间
  count: number            // 累计执行次数
}
```

**持久化**：使用 Tabby 的 `ConfigService` 存储 Tabby 自己记录的历史数据。Shell 历史文件只读不写。

**合并逻辑**：
- 读取 Shell 历史文件 + Tabby 持久化数据
- 按 `command + profileId` 去重
- 冲突时保留更近的 `timestamp`，累加 `count`

**记录时机**：通过监听 `tab.session.output$` 捕获命令执行完成的信号（如收到新的 prompt），将上一条输入的命令记录到 Tabby 历史中。

### 2. 匹配与排序层

#### 2.1 匹配算法（MatchingService）

**双层匹配策略**：

1. **前缀匹配**（优先）— 当前输入文本作为前缀，匹配所有以该文本开头的历史命令
2. **模糊匹配**（兜底）— 将输入文本作为子序列，匹配包含这些字符且顺序一致的历史命令

**模糊匹配实现**：使用经典的双指针子序列算法，字符必须按顺序出现但不需要连续。例如输入 `gco` 可以匹配 `git checkout`（g...c...o 均按序出现）。

**合并逻辑**：
- 先执行前缀匹配，收集结果
- 再执行模糊匹配，排除已在前缀匹配中的条目
- 两组结果拼接返回，前缀匹配的排在前面

#### 2.2 排序算法（ScoringService）

**热度评分公式**：

```
score = recencyWeight * recencyScore + frequencyWeight * frequencyScore
```

- **recencyScore**: 基于最后使用时间的衰减分数，越近越高。使用指数衰减：`e^(-(now - lastUsed) / halfLife)`，halfLife 默认 7 天
- **frequencyScore**: 基于使用次数的对数分数：`log2(count + 1)`，避免高频命令永远霸榜
- **权重默认值**: `recencyWeight = 0.7`，`frequencyWeight = 0.3`（近期使用更重要）

**排序流程**：
- 前缀匹配结果和模糊匹配结果分别计算热度分数
- 各组内部按分数降序排列
- 最终列表 = 前缀匹配结果（按热度排序）+ 模糊匹配结果（按热度排序）

#### 2.3 性能考虑

- 历史命令列表通常在几百到几千条，匹配和排序在每次输入变化时执行
- 使用 RxJS `debounceTime`（300ms）+ `filter`（输入长度 >= 2）控制触发频率
- 匹配结果限制最大显示数量（默认 20 条），避免 UI 卡顿

### 3. UI 与交互层

#### 3.1 终端装饰器（TerminalDecorator）

这是插件的核心入口，负责监听终端输入并触发下拉列表。

**工作流程**：

1. `attach(tab)` 被调用时，订阅 `tab.sessionChanged$` 和当前 session
2. 订阅 `tab.input$`，收集用户实时输入的字符（逐字符累积为当前输入行）
3. 通过 RxJS 管道处理：`bufferTime(50)` → 拼接 → `debounceTime(300)` → `filter(len >= 2)`
4. 触发匹配流程，将结果传给下拉列表组件

**输入行追踪**：
- 维护一个 `currentInput` 缓冲区，逐字符追加
- 收到回车（`\r`）时清空缓冲区，并将该命令交给 HistoryService 记录
- 收到退格（`\x7f`）时删除最后一个字符
- 收到 Ctrl+C 时清空缓冲区

#### 3.2 下拉列表组件（DropdownComponent）

**定位**：动态创建的 Angular 组件，挂载到终端 tab 的 DOM 中，定位在当前光标位置附近。

**UI 结构**：

```
┌──────────────────────────────────┐
│  🔍 git checkout feature-branch │  ← 输入框（只读，显示当前输入）
├──────────────────────────────────┤
│▸ git checkout feature-branch     │  ← 前缀匹配结果（高亮）
│  git checkout main               │
│  git commit -m "..."             │
│  git config --global user.name   │  ← 模糊匹配结果（稍淡）
│  ...                             │
├──────────────────────────────────┤
│  ↑↓ 选择  Enter 确认  Tab 补全   │  ← 操作提示栏
└──────────────────────────────────┘
```

**样式**：
- 使用 Tabby 的主题 CSS 变量（`--theme-bg`、`--theme-fg`、`--theme-accent` 等）
- 圆角、轻微阴影，与 Tabby 设置面板风格一致
- 选中项用 `--theme-accent` 背景高亮
- 最大高度约 300px，超出时内部滚动

**交互键绑定**：

| 按键 | 行为 |
|------|------|
| `↑` / `↓` | 上下移动选中项 |
| `Enter` | 确认选中项，填入终端 |
| `Tab` | 快速补全第一项 |
| `Esc` | 关闭下拉列表 |
| 继续输入 | 更新列表（不关闭） |
| 鼠标悬停 | 高亮该项 |
| 鼠标点击 | 确认选中项 |

**命令注入**：选中命令后，先通过 `session.write()` 发送退格字符（`\x7f`）清除当前已输入的文本（次数等于 `currentInput` 长度），再写入选中的命令文本。不自动回车，让用户确认后再按 Enter 执行。

**键盘事件拦截**：当下拉列表显示时，装饰器需要拦截 `tab.keyboardInput$` 事件，阻止 Enter/Tab/↑/↓/Esc 等按键传递到终端会话，改为由下拉列表组件处理。列表关闭后恢复正常传递。

### 4. 配置与设置层

#### 4.1 配置项定义（ConfigProvider）

```typescript
interface CommandTipsConfig {
  enabled: boolean                    // 是否启用插件，默认 true
  minChars: number                    // 最少触发字符数，默认 2
  debounceMs: number                  // 延迟触发毫秒数，默认 300
  maxResults: number                  // 下拉列表最大显示数，默认 20
  scoring: {
    recencyWeight: number             // 时间权重，默认 0.7
    frequencyWeight: number           // 频率权重，默认 0.3
    halfLifeDays: number              // 时间衰减半衰期（天），默认 7
  }
  matching: 'prefix-fuzzy' | 'prefix-only' | 'fuzzy-only'  // 匹配模式，默认 prefix-fuzzy
  showSourceTag: boolean              // 是否显示来源标签（shell/tabby），默认 false
  tabCompletesFirst: boolean          // Tab 是否补全第一项，默认 true
}
```

所有配置项都有合理默认值，开箱即用。

#### 4.2 快捷键定义（HotkeyProvider）

| 动作 | 默认快捷键 |
|------|-----------|
| 打开/关闭命令提示列表 | `Ctrl+Shift+P` |
| 清空当前 profile 的 Tabby 历史 | 无默认，需手动设置 |

快捷键可在 Tabby 的快捷键设置中自定义。

#### 4.3 设置页面（SettingsTabComponent）

设置页面包含以下区域：

- **启用开关**：全局启用/禁用插件
- **触发设置**：最少字符数、延迟触发毫秒数、最大显示数
- **匹配模式**：前缀优先 + 模糊兜底 / 仅前缀匹配 / 仅模糊匹配
- **排序权重**：时间权重和频率权重的滑块
- **显示选项**：来源标签、Tab 补全开关
- **数据管理**：显示当前 profile 历史条数，提供清空按钮

使用 Tabby 的 `ng-bootstrap` 组件，风格与其他设置页面一致。

### 5. 数据流与生命周期

#### 5.1 整体数据流

```
用户输入字符
    │
    ▼
TerminalDecorator.attach() 监听 tab.input$
    │
    ▼
输入行缓冲区累积（currentInput）
    │
    ▼
RxJS 管道：bufferTime(50ms) → debounceTime(300ms) → filter(length >= 2)
    │
    ▼
MatchingService.execute(currentInput, historyEntries)
    │
    ├─ 前缀匹配结果
    └─ 模糊匹配结果（排除前缀已有）
    │
    ▼
ScoringService.sort(combinedResults)
    │
    ▼
DropdownComponent.updateSuggestions(sortedResults)
    │
    ▼
用户选择/取消
    │
    ├─ 选中 → session.write(command) 写入终端
    └─ 取消 / 继续输入 → 关闭或更新列表
```

#### 5.2 命令记录流

```
用户按下 Enter（currentInput 收到 \r）
    │
    ▼
HistoryService.recordCommand(command, profileId, 'tabby')
    │
    ├─ 写入 Tabby 持久化存储
    └─ 更新内存中的历史索引
```

#### 5.3 生命周期管理

**插件初始化**：
1. Angular 模块加载时，`HistoryService` 初始化
2. 读取配置，加载持久化的 Tabby 历史数据到内存
3. `TerminalDecorator` 等待 tab 附加

**Session 绑定**：
1. `TerminalDecorator.attach(tab)` 被调用
2. 订阅 `tab.sessionChanged$`，当 session 变化时：
   - 通过 `ShellDetectorService` 检测 shell 类型
   - 读取对应的 shell 历史文件
   - 与 Tabby 持久化数据合并，建立当前 profile 的历史索引
3. 订阅 `tab.input$`，开始监听用户输入

**Session 断开**：
- 取消所有 RxJS 订阅（`unsubscribe`）
- 关闭下拉列表（如果正在显示）
- 历史数据已持久化，无需额外处理

**插件卸载**：
- Angular 模块销毁时自动清理所有订阅和服务
- 持久化数据保留在 Tabby 配置中，重装后可恢复

#### 5.4 错误处理

| 场景 | 处理方式 |
|------|---------|
| Shell 历史文件不存在 | 跳过，仅使用 Tabby 历史 |
| Shell 历史文件格式异常 | 记录警告日志，跳过损坏的行 |
| 持久化数据损坏 | 重置为空，记录错误日志 |
| 匹配结果为空 | 下拉列表显示"无匹配结果"，延迟后自动关闭 |
