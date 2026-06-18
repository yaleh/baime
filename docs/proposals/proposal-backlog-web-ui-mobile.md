# Proposal: 改进 backlog.md web UI 移动端适配

## Background

backlog.md v1.45.0 的 web UI 在 390×844px 的移动端视口下存在三处严重可用性问题：(1) 侧边栏默认展开，占据视口宽度的 74%（约 290px/390px），主内容区仅剩约 100px 的不可用条状区域，且每次页面导航均重置展开状态；(2) Kanban 看板列总宽度达 2432px，是视口宽度的 9 倍，无法左右滑动也无列导航指示；(3) All Tasks 表格宽度 1456px（视口的 3.7 倍），在移动端仅能显示 ID 和部分标题，其余字段全部不可见。backlog.md 以预编译二进制形式分发（`backlog.md-linux-x64`），不暴露任何插件接口或自定义 CSS 入口，因此必须通过外部注入的方式修复这些问题，而不能改动其源代码。这些问题导致团队成员在移动设备上无法有效查看和管理 backlog，影响项目可见性和协作效率。

## Goals

1. 在 390px 视口下，侧边栏默认折叠，主内容区可用宽度 ≥ 340px（可通过浏览器开发者工具或 Puppeteer 截图验证）。
2. 侧边栏折叠/展开状态持久化到 `localStorage`，页面刷新或导航后状态保持不变（可通过多次导航后检查 `localStorage.getItem('sidebar-collapsed')` 验证）。
3. Kanban 看板列在移动端支持水平滚动，且每列最小宽度 ≥ 280px，视口内完整显示至少一列（可通过截图和 `document.querySelector('.kanban-board').scrollWidth` 验证）。
4. All Tasks 表格在 ≤ 480px 视口下切换为卡片式布局，每张卡片至少展示 ID、Title、Status 和 Priority（可通过 Puppeteer 截图或浏览器响应式模式检查 DOM 验证）。
5. 以上改进通过本地反向代理（Node.js 脚本）向 backlog.md 的响应注入自定义 CSS 和轻量 JS 实现，不修改 backlog.md 包本身（可通过检查代理脚本源码和 `npm list -g backlog.md` 版本号一致性验证）。

## Proposed Approach

**注入层：本地 Node.js 反向代理**

构建一个轻量 Node.js HTTP 代理脚本（`scripts/mobile-proxy.js`），监听新端口（如 6422），将所有请求透传给 backlog.md 原始端口（如 6420）。对 HTML 响应，代理在 `</head>` 前注入一个 `<link>` 标签（指向代理自身提供的静态文件 `mobile-overrides.css`）和一小段内联 `<script>`（用于侧边栏状态持久化逻辑）。非 HTML 响应（静态资源、API）直接透传，不做修改。

**CSS 覆盖层：`mobile-overrides.css`**

使用 `@media (max-width: 480px)` 媒体查询，针对三类问题分别提供 CSS 规则：
- **侧边栏**：默认将侧边栏容器宽度设为 0 / `transform: translateX(-100%)` 并隐藏，通过 `.sidebar-expanded` 类恢复展开；放大折叠按钮触摸目标至 ≥ 44×44px。
- **Kanban 看板**：将看板容器设为 `overflow-x: auto; -webkit-overflow-scrolling: touch`，各列设 `min-width: 280px; flex-shrink: 0`，启用原生动量滚动。
- **All Tasks 表格**：将 `<table>` 及其子元素重排为卡片布局（`display: block` + `data-label` 伪元素），每行独立成卡，关键字段垂直排列。

**JS 持久化层（内联脚本）**

注入约 20 行脚本，在 `DOMContentLoaded` 时读取 `localStorage` 中的侧边栏状态，并在折叠按钮点击时写回，确保状态跨导航持久化。

**集成与启动**

在 `package.json`（或 `Makefile`）中添加 `start:mobile` 命令，同时启动 backlog.md（原始端口）和代理脚本（移动端端口），并在 `backlog/config.yml` 中记录移动端访问地址。

## Trade-offs and Risks

**不做的事**：不修改 backlog.md 的上游源代码或已安装包文件；不引入构建工具或框架；不处理平板（481–1024px）区间（超出本次范围）；不实现离线 PWA 能力。

**已考虑的替代方案**：
- *浏览器扩展 / Tampermonkey 脚本*：需要每位团队成员手动安装，运维成本高，故排除。
- *Wrapper iframe 页面*：跨域限制使 iframe 内的 JS 注入复杂化，且 backlog.md 的 `X-Frame-Options` 策略未知，故排除。
- *上游 issue*：已列为并行动作，但不能作为短期解决方案依赖。

**已知风险**：
- backlog.md 的内部 CSS 类名（选择器）在未来版本升级时可能变更，导致覆盖规则失效；需在升级时回归测试。
- 代理脚本的 HTML 注入依赖响应内容包含 `</head>` 字符串，若 backlog.md 将 HTML 分块流式传输则需做流式拼接处理。
- 侧边栏持久化脚本依赖能够定位折叠按钮的 DOM 选择器，与上述类名风险相同。
