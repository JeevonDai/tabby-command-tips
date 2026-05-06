# LLM 提示功能设计文档

## 概述

为 tabby-command-tips 插件添加 LLM 提示功能，实现历史记录匹配和 LLM 建议的实时增强模式。用户输入时同时查询历史记录和 LLM，优先显示历史记录结果，LLM 结果异步加载后追加到列表中。

## 需求分析

### 功能需求

1. **触发方式**：实时增强模式 - 用户输入时同时查询历史记录和 LLM，合并结果
2. **LLM 服务**：可配置模式 - 用户自行配置 API 端点和密钥，支持多种服务（OpenAI、Anthropic、本地模型）
3. **提示内容**：
   - 命令补全：根据用户输入的前缀，预测并补全完整的命令
   - 命令建议：根据上下文（当前目录、最近命令）推荐相关命令
4. **显示方式**：混合显示 - LLM 结果和历史记录结果混合在同一个列表中，用不同标签区分
5. **延迟处理**：优先历史记录 - 先显示历史记录匹配结果，LLM 结果异步加载后追加到列表中

### 非功能需求

1. **性能**：LLM 调用不应阻塞 UI，历史记录匹配应保持同步响应
2. **可靠性**：LLM 服务不可用时，插件应能降级到仅历史记录模式
3. **可配置性**：用户可自定义 LLM 提供商、模型、超时时间等参数
4. **可测试性**：所有组件应易于单元测试和集成测试

## 架构设计

### 整体架构

```
用户输入 → TerminalDecorator.onInput()
    ↓
    ├── 历史记录匹配（同步）
    │   ├── 显示下拉列表（历史记录结果）
    │   └── 返回 MatchResult[]
    │
    └── LLM 匹配（异步）
        ├── 调用 LlmService.complete() / suggest()
        ├── 等待 API 响应
        └── 追加到 currentSuggestions
            └── 更新下拉列表显示
```

### 组件划分

#### 新增组件

1. **LlmService** (`src/services/llm_service.ts`)
   - 封装 LLM API 调用逻辑
   - 支持配置多种 LLM 服务
   - 提供命令补全和命令建议两种模式
   - 处理 API 密钥、端点等配置

2. **LlmConfig** (在 `models.ts` 中扩展)
   - LLM 相关配置项
   - API 端点、密钥、模型名称
   - 启用/禁用开关
   - 提示模式选择

#### 修改组件

1. **MatchingService** (`src/services/matching_service.ts`)
   - 新增 `executeWithLlm()` 方法
   - 同时调用历史记录匹配和 LLM 匹配
   - 返回统一的匹配结果流

2. **TerminalDecorator** (`src/decorators/terminal_decorator.ts`)
   - 订阅 LLM 异步结果
   - 实现结果追加逻辑
   - 更新下拉列表显示

## 详细设计

### LlmService 设计

#### 接口定义

```typescript
/** LLM 服务接口，支持多种 LLM 提供商 */
@Injectable()
export class LlmService {
  /** 命令补全：根据输入前缀预测完整命令 */
  public complete(input: string, context: LlmContext): Promise<LlmResult[]>

  /** 命令建议：根据上下文推荐相关命令 */
  public suggest(input: string, context: LlmContext): Promise<LlmResult[]>

  /** 检查 LLM 服务是否可用 */
  public isAvailable(): boolean
}
```

#### 数据结构

```typescript
/** LLM 调用所需的上下文信息 */
export interface LlmContext {
  currentDirectory: string
  recentCommands: string[]
  shellType: string
  currentUser: string
}

/** LLM 返回的匹配结果 */
export interface LlmResult {
  command: string
  description?: string
  matchType: 'completion' | 'suggestion'
  confidence: number
}
```

#### 配置结构

```typescript
/** LLM 配置 */
export interface LlmConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'local'
  endpoint: string
  apiKey: string
  model: string
  maxResults: number
  timeoutMs: number
  modes: ('completion' | 'suggestion')[]
}
```

### MatchingService 修改

#### 新增方法

```typescript
/** 统一匹配接口：同时执行历史记录匹配和 LLM 匹配 */
public executeWithLlm(
  input: string,
  entries: HistoryEntry[],
  mode: CommandTipsConfig['matching'],
  llmContext: LlmContext,
): Observable<MatchResult[]>
```

#### MatchResult 扩展

```typescript
export interface MatchResult {
  entry: HistoryEntry
  matchType: 'prefix' | 'fuzzy' | 'llm-completion' | 'llm-suggestion'
  confidence?: number
  description?: string
}
```

#### 匹配流程

1. 同步执行历史记录匹配
2. 异步执行 LLM 匹配
3. 合并结果并返回

### TerminalDecorator 修改

#### 新增属性

```typescript
private llmSubscription: Subscription | null = null
private llmLoading = false
private llmLoaded = false
```

#### 核心修改点

1. **executeMatch 方法**：调用 `executeWithLlm()` 替代原来的 `execute()`
2. **renderFullList 方法**：支持显示 LLM 结果的特殊标签
3. **hideDropdown 方法**：清理 LLM 订阅
4. **detach 方法**：清理 LLM 订阅

#### 显示逻辑

- 历史记录结果：绿色 "P"（前缀匹配）、黄色 "F"（模糊匹配）
- LLM 结果：蓝色 "C"（命令补全）、紫色 "S"（命令建议）
- LLM 状态指示器：显示 "⏳ AI 加载中..." 或 "✓ AI 已加载"

### 配置界面设计

在 `settings_tab_component.ts` 中添加 LLM 配置区域：

- 启用/禁用开关
- LLM 提供商选择
- API 端点配置
- API 密钥配置
- 模型名称配置
- 最大返回结果数
- 请求超时时间
- 提示模式选择

## 错误处理

### 错误分类

```typescript
export enum LlmErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
}
```

### 错误处理策略

1. **静默降级**：LLM 服务不可用时，只显示历史记录结果
2. **状态提示**：在下拉列表中显示 LLM 服务状态
3. **重试机制**：支持指数退避重试（最多 3 次）
4. **错误日志**：记录错误日志便于排查

### 降级场景

- 网络连接失败
- API 认证失败
- 请求超时
- API 返回错误
- 响应解析失败
- 配置错误

## 测试策略

### 单元测试

#### LlmService 测试

- 测试命令补全功能
- 测试命令建议功能
- 测试 API 错误处理
- 测试超时处理
- 测试配置验证

#### MatchingService 测试

- 测试统一匹配接口
- 测试历史记录和 LLM 结果合并
- 测试 LLM 不可用时的降级

#### TerminalDecorator 测试

- 测试 LLM 结果追加逻辑
- 测试显示状态更新
- 测试订阅清理

### 集成测试

- 完整流程测试：输入 → 匹配 → LLM → 显示 → 选择
- 错误恢复测试：LLM 服务不可用 → 降级 → 恢复
- 配置变更测试：修改 LLM 配置后的行为

### 测试覆盖率目标

- LlmService: 90% 以上
- MatchingService: 85% 以上
- TerminalDecorator: 80% 以上
- 错误处理: 100% 错误路径覆盖

### Mock 策略

- Mock LlmService 用于单元测试
- Mock HttpClient 用于 API 调用测试
- Mock ConfigService 用于配置测试

## 实现计划

### 阶段 1：基础架构

1. 在 `models.ts` 中添加 LLM 配置结构
2. 创建 `LlmService` 基础框架
3. 实现 LLM API 调用逻辑

### 阶段 2：匹配服务集成

1. 扩展 `MatchResult` 接口
2. 实现 `executeWithLlm()` 方法
3. 添加结果合并逻辑

### 阶段 3：UI 集成

1. 修改 `TerminalDecorator` 支持 LLM 结果
2. 更新下拉列表显示逻辑
3. 添加 LLM 状态指示器

### 阶段 4：配置界面

1. 扩展设置界面
2. 添加 LLM 配置区域
3. 实现配置验证

### 阶段 5：错误处理和测试

1. 实现错误处理机制
2. 添加重试策略
3. 编写单元测试和集成测试

## 风险评估

### 技术风险

1. **API 调用延迟**：LLM API 响应可能较慢，影响用户体验
   - 缓解措施：设置合理的超时时间，优先显示历史记录结果

2. **API 成本**：频繁调用 LLM API 可能产生较高成本
   - 缓解措施：添加调用频率限制，支持本地模型

3. **配置复杂性**：用户需要配置 API 密钥等敏感信息
   - 缓解措施：提供清晰的配置界面和文档

### 缓解措施

1. **性能优化**：使用缓存、减少不必要的 API 调用
2. **降级策略**：LLM 服务不可用时自动降级
3. **用户教育**：提供详细的配置文档和使用指南

## 总结

本设计方案实现了 LLM 提示功能的核心需求，通过独立 LlmService 和统一匹配接口的架构，实现了历史记录匹配和 LLM 建议的实时增强。设计考虑了性能、可靠性、可配置性和可测试性，为用户提供了强大的命令提示功能。
