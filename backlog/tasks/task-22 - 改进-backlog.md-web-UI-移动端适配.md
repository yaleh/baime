---
id: TASK-22
title: 改进 backlog.md web UI 移动端适配
status: Basic: Backlog
assignee: []
created_date: '2026-06-18 01:12'
updated_date: '2026-06-18 01:21'
labels:
  - kind:basic
dependencies: []
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
改进 backlog.md web UI 的移动端适配。背景：通过 puppeteer 截图对 backlog.md v1.45.0（port 6422）做了完整移动端可用性检查（390×844px，iPhone 12 模拟），发现多处严重问题影响移动端使用。
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Plan: 改进 backlog.md web UI 移动端适配

Proposal: docs/proposals/proposal-backlog-web-ui-mobile.md

## Phase A: 创建移动端 CSS override 文件

### Tests (write first)
```bash
test -f scripts/mobile-overrides.css
grep -q "@media (max-width: 480px)" scripts/mobile-overrides.css
grep -q "min-width: 280px" scripts/mobile-overrides.css
grep -q "overflow-x: auto" scripts/mobile-overrides.css
grep -q "display: block" scripts/mobile-overrides.css
```

### Implementation
- 创建 scripts/mobile-overrides.css，包含三组 @media 规则：
  - 侧边栏：默认折叠（transform: translateX(-100%) 或 width: 0），展开时主内容区宽度 ≥ 340px
  - Kanban：overflow-x: auto; 各列 min-width: 280px; flex-shrink: 0
  - All Tasks 表格：display: block 卡片布局，展示 ID/Title/Status/Priority

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/mobile-overrides.css`
- [ ] `grep -q "@media (max-width: 480px)" scripts/mobile-overrides.css`
- [ ] `grep -q "min-width: 280px" scripts/mobile-overrides.css`
- [ ] `grep -q "overflow-x: auto" scripts/mobile-overrides.css`
- [ ] `grep -q "display: block" scripts/mobile-overrides.css`

## Phase B: 创建 Node.js 反向代理脚本

### Tests (write first)
```bash
test -f scripts/mobile-proxy.js
node --check scripts/mobile-proxy.js
grep -q "mobile-overrides.css" scripts/mobile-proxy.js
grep -q "</head>" scripts/mobile-proxy.js
grep -q "6422" scripts/mobile-proxy.js
```

### Implementation
- 创建 scripts/mobile-proxy.js：Node.js http-proxy 脚本，监听 6422 端口，转发到 6423
- 拦截 HTML 响应，在 </head> 前注入 <link rel="stylesheet" href="/mobile-overrides.css"> 标签
- 同时提供 /mobile-overrides.css 静态文件端点
- 非 HTML 响应直接透传

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/mobile-proxy.js`
- [ ] `node --check scripts/mobile-proxy.js`
- [ ] `grep -q "mobile-overrides.css" scripts/mobile-proxy.js`
- [ ] `grep -q "</head>" scripts/mobile-proxy.js`
- [ ] `grep -q "6422" scripts/mobile-proxy.js`

## Phase C: 添加 sidebar 状态持久化 JS 注入

### Tests (write first)
```bash
grep -q "localStorage" scripts/mobile-proxy.js
grep -q "max-width: 480px" scripts/mobile-proxy.js
grep -q "DOMContentLoaded" scripts/mobile-proxy.js
grep -q "sidebar" scripts/mobile-proxy.js
```

### Implementation
- 在 scripts/mobile-proxy.js 中增加 JS 片段注入逻辑：
  - 读取/写入 localStorage['backlog-sidebar-collapsed']
  - 在 DOMContentLoaded 时根据 window.matchMedia('(max-width: 480px)') 和 localStorage 状态自动折叠侧边栏
  - 监听折叠按钮点击事件，更新 localStorage 状态
- 将 JS 片段作为内联 <script> 在 </head> 前注入（与 CSS link 一起）

### DoD
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `grep -q "localStorage" scripts/mobile-proxy.js`
- [ ] `grep -q "max-width: 480px" scripts/mobile-proxy.js`
- [ ] `grep -q "DOMContentLoaded" scripts/mobile-proxy.js`
- [ ] `grep -q "sidebar" scripts/mobile-proxy.js`

## Constraints
- 不修改 backlog.md 包本身（node_modules 或二进制）
- 代理脚本仅注入 <link> 和一段内联 <script>，不做完整 HTML 解析
- CSS 选择器针对 backlog.md v1.45.0；升级时需重新验证
- 不处理平板（481–1024px）区间（超出本次范围）
- 不引入构建工具或框架

## Acceptance Gate
- [ ] `bash scripts/validate-plugin.sh`
- [ ] `test -f scripts/mobile-overrides.css && test -f scripts/mobile-proxy.js`
- [ ] `node --check scripts/mobile-proxy.js`
- [ ] `grep -q "min-width: 280px" scripts/mobile-overrides.css`
- [ ] `grep -q "overflow-x: auto" scripts/mobile-overrides.css`
- [ ] `grep -q "display: block" scripts/mobile-overrides.css`
- [ ] `grep -q "localStorage" scripts/mobile-proxy.js`
- [ ] `grep -q "DOMContentLoaded" scripts/mobile-proxy.js`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal review iteration 1: APPROVED

Proposal approved in 1 iteration. Starting plan draft.

Plan review iteration 1: NEEDS_REVISION — fixed issues: (1) Tests sections converted from natural-language bullets to shell commands for true TDD red-first structure; (2) Phase A/B/C DoD and Acceptance Gate strengthened with specific grep checks covering all 5 proposal goals (kanban min-width, overflow-x scroll, card display:block, localStorage, DOMContentLoaded); (3) Constraints section augmented with two missing constraints from proposal trade-offs.

Plan review iteration 2: APPROVED

Docs committed: docs/proposals/proposal-backlog-web-ui-mobile.md + docs/plans/113-backlog-web-ui-mobile.md
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bash scripts/validate-plugin.sh
- [ ] #2 test -f scripts/mobile-overrides.css
- [ ] #3 grep -q "@media (max-width: 480px)" scripts/mobile-overrides.css
- [ ] #4 grep -q "min-width: 280px" scripts/mobile-overrides.css
- [ ] #5 grep -q "overflow-x: auto" scripts/mobile-overrides.css
- [ ] #6 grep -q "display: block" scripts/mobile-overrides.css
- [ ] #7 bash scripts/validate-plugin.sh
- [ ] #8 test -f scripts/mobile-proxy.js
- [ ] #9 node --check scripts/mobile-proxy.js
- [ ] #10 grep -q "mobile-overrides.css" scripts/mobile-proxy.js
- [ ] #11 grep -q "</head>" scripts/mobile-proxy.js
- [ ] #12 grep -q "6422" scripts/mobile-proxy.js
- [ ] #13 bash scripts/validate-plugin.sh
- [ ] #14 grep -q "localStorage" scripts/mobile-proxy.js
- [ ] #15 grep -q "max-width: 480px" scripts/mobile-proxy.js
- [ ] #16 grep -q "DOMContentLoaded" scripts/mobile-proxy.js
- [ ] #17 grep -q "sidebar" scripts/mobile-proxy.js
- [ ] #18 bash scripts/validate-plugin.sh
- [ ] #19 test -f scripts/mobile-overrides.css && test -f scripts/mobile-proxy.js
- [ ] #20 node --check scripts/mobile-proxy.js
- [ ] #21 grep -q "min-width: 280px" scripts/mobile-overrides.css
- [ ] #22 grep -q "overflow-x: auto" scripts/mobile-overrides.css
- [ ] #23 grep -q "display: block" scripts/mobile-overrides.css
- [ ] #24 grep -q "localStorage" scripts/mobile-proxy.js
- [ ] #25 grep -q "DOMContentLoaded" scripts/mobile-proxy.js
<!-- DOD:END -->
