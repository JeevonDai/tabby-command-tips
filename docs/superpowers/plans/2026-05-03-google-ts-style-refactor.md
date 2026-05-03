# Google TypeScript Style Guide 重构计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 tabby-command-tips 项目全面重构为符合 Google TypeScript Style Guide 的代码风格

**Architecture:** 两阶段执行 — 先串行完成文件重命名和 import 路径更新，再并行重构代码内容（格式、类型注解、访问修饰符、import 排序）

**Tech Stack:** TypeScript 4.2, Angular 12, Webpack 5, Jasmine

---

## 规范摘要

| 规则 | 要求 |
|------|------|
| 文件命名 | `snake_case.ts` / `snake_case.pug` / `snake_case.scss` |
| import 排序 | 第三方 → 空行 → 本地，各组内字母排序 |
| 分号 | 不使用 |
| 缩进 | 2 空格 |
| 引号 | 单引号 |
| 尾逗号 | 多行结构必须有 |
| 返回值类型注解 | 导出函数/方法必须显式标注 |
| 访问修饰符 | 类成员必须显式 `public`/`private`/`protected` |
| readonly | 不可变属性标记 `readonly` |
| 命名 | 变量/函数 `camelCase`，类/接口/类型 `PascalCase`，常量 `SCREAMING_SNAKE_CASE` |

---

## Task 1: 文件重命名 + import 路径更新（串行）

**Files:** 全部 12 个 `.ts` 文件 + 4 个模板/样式文件 + 1 个测试文件

### 重命名映射

| 原路径 | 新路径 |
|--------|--------|
| `src/providers/configProvider.ts` | `src/providers/config_provider.ts` |
| `src/providers/hotkeyProvider.ts` | `src/providers/hotkey_provider.ts` |
| `src/providers/settingsTabProvider.ts` | `src/providers/settings_tab_provider.ts` |
| `src/components/dropdown.component.ts` | `src/components/dropdown_component.ts` |
| `src/components/dropdown.component.pug` | `src/components/dropdown_component.pug` |
| `src/components/dropdown.component.scss` | `src/components/dropdown_component.scss` |
| `src/services/matching.service.ts` | `src/services/matching_service.ts` |
| `src/services/scoring.service.ts` | `src/services/scoring_service.ts` |
| `src/services/shell-detector.service.ts` | `src/services/shell_detector_service.ts` |
| `src/services/history.service.ts` | `src/services/history_service.ts` |
| `src/settings/settingsTab.component.ts` | `src/settings/settings_tab_component.ts` |
| `src/settings/settingsTab.component.pug` | `src/settings/settings_tab_component.pug` |
| `src/settings/settingsTab.component.scss` | `src/settings/settings_tab_component.scss` |
| `src/decorators/terminal-decorator.ts` | `src/decorators/terminal_decorator.ts` |
| `tests/shell-detector.service.spec.ts` | `tests/shell_detector_service.spec.ts` |

### 步骤

- [ ] **Step 1.1:** 用 `git mv` 重命名所有文件
- [ ] **Step 1.2:** 更新 `src/index.ts` 中所有 import 路径
- [ ] **Step 1.3:** 更新 `src/providers/settingsTabProvider.ts` 中对 `settingsTab.component` 的 import
- [ ] **Step 1.4:** 更新 `src/settings/settingsTab.component.ts` 中对 `history.service` 和 `models` 的 import
- [ ] **Step 1.5:** 更新 `src/decorators/terminal-decorator.ts` 中对 services 的 import
- [ ] **Step 1.6:** 更新 `src/components/dropdown.component.ts` 中对 `matching.service` 的 import
- [ ] **Step 1.7:** 更新 `tests/shell-detector.service.spec.ts` 中对 `shell-detector.service` 的 import
- [ ] **Step 1.8:** 更新模板/样式引用（`require('./dropdown.component.pug')` → `require('./dropdown_component.pug')`）
- [ ] **Step 1.9:** 运行 `npm run build` 验证重命名后编译通过
- [ ] **Step 1.10:** 提交 `refactor: rename files to snake_case per Google TS Style Guide`

---

## Task 2: 格式化重构（并行组 A）

**负责文件:** `src/index.ts`, `src/models.ts`, `src/providers/config_provider.ts`, `src/providers/hotkey_provider.ts`, `src/providers/settings_tab_provider.ts`, `src/components/dropdown_component.ts`

### 每个文件的改动

- [ ] **Step 2.1:** 去除所有语句末尾分号
- [ ] **Step 2.2:** 字符串统一使用单引号
- [ ] **Step 2.3:** 多行结构添加尾逗号
- [ ] **Step 2.4:** import 分组排序（第三方 → 空行 → 本地，各组内字母排序）
- [ ] **Step 2.5:** 运行 `npm run build` 验证编译通过
- [ ] **Step 2.6:** 提交 `style: format files per Google TS Style Guide (group A)`

---

## Task 3: 类型注解 + 访问修饰符重构（并行组 B）

**负责文件:** `src/services/matching_service.ts`, `src/services/scoring_service.ts`, `src/services/shell_detector_service.ts`, `src/services/history_service.ts`

### 每个文件的改动

- [ ] **Step 3.1:** 去除所有语句末尾分号
- [ ] **Step 3.2:** 字符串统一使用单引号
- [ ] **Step 3.3:** 多行结构添加尾逗号
- [ ] **Step 3.4:** import 分组排序
- [ ] **Step 3.5:** 所有导出函数/方法添加显式返回值类型注解
- [ ] **Step 3.6:** 类成员添加显式访问修饰符（`public`/`private`/`protected`）
- [ ] **Step 3.7:** 不可变属性标记 `readonly`
- [ ] **Step 3.8:** 运行 `npm run build` 验证编译通过
- [ ] **Step 3.9:** 提交 `style: add type annotations and access modifiers (group B)`

---

## Task 4: 设置 + 装饰器 + 测试重构（并行组 C）

**负责文件:** `src/settings/settings_tab_component.ts`, `src/decorators/terminal_decorator.ts`, `tests/shell_detector_service.spec.ts`

### 每个文件的改动

- [ ] **Step 4.1:** 去除所有语句末尾分号
- [ ] **Step 4.2:** 字符串统一使用单引号
- [ ] **Step 4.3:** 多行结构添加尾逗号
- [ ] **Step 4.4:** import 分组排序
- [ ] **Step 4.5:** 所有导出函数/方法添加显式返回值类型注解
- [ ] **Step 4.6:** 类成员添加显式访问修饰符
- [ ] **Step 4.7:** 不可变属性标记 `readonly`
- [ ] **Step 4.8:** `terminal_decorator.ts` 中的 `any` 类型处添加类型断言注释
- [ ] **Step 4.9:** 运行 `npm run build` 验证编译通过
- [ ] **Step 4.10:** 运行 `npm test` 验证测试通过
- [ ] **Step 4.11:** 提交 `style: refactor settings, decorator, and tests (group C)`

---

## Task 5: 最终验证

- [ ] **Step 5.1:** 运行 `npm run build` 确认全量编译通过
- [ ] **Step 5.2:** 运行 `npm test` 确认测试通过
- [ ] **Step 5.3:** 人工抽查 2-3 个文件确认风格符合 Google TS Style Guide
- [ ] **Step 5.4:** 提交 `chore: final verification and cleanup`
