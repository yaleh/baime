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
