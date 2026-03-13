# Proposal: 目录重组、打包与发布机制

## 背景

对比 meta-cc 项目的成熟实践与 Claude Code 官方规范，BAIME 当前存在三个层面的问题：

**问题 1：目录结构不符合官方规范**
- Claude Code 要求插件根目录下有 `.claude-plugin/plugin.json`
- BAIME 当前插件内容在 `.claude/` 下，是项目本地配置目录而非插件目录
- 导致 `--plugin-dir ./`、`/plugin marketplace add` 均无法正常工作

**问题 2：`marketplace.json` 格式错误**
- 缺少 `$schema`、`owner`、`plugins[]` 数组等必填字段
- 当前格式无法被 `/plugin marketplace add yaleh/baime` 识别

**问题 3：没有发布基础设施**
- 无 `CHANGELOG.md`、无 git tag、无 `release.sh`、无 GitHub Release
- 用户无法获知版本历史，无法追踪 breaking changes

---

## 参照：meta-cc 的成熟模式

meta-cc 的关键架构决策：

| 关注点 | meta-cc 的解法 | 说明 |
|--------|--------------|------|
| 插件根目录 | `plugin-src/` | 与 repo 根分离，内含 `.claude-plugin/plugin.json` |
| Marketplace | `.claude-plugin/marketplace.json`，`source: "./plugin-src"` | 符合官方 schema |
| 版本管理 | `marketplace.json` + `plugin.json` 双文件，`release.sh` 自动同步 | 版本锁定，防止漂移 |
| 发布流程 | `pre-release-check.sh` → `release.sh` → git tag → GitHub Actions | 完整自动化 |
| CHANGELOG | Keep a Changelog 格式，`generate-changelog-entry.sh` 自动生成 | 可追溯 |
| 安装 | `make install-user` / `make install-local` | 两种 scope |

BAIME 是纯 Markdown，无二进制编译，可大幅简化上述流程，但核心架构模式应对齐。

---

## 目标结构

### 当前结构（问题态）

```
baime/
├── .claude/                         ← 插件内容混在项目本地配置目录
│   ├── .claude-plugin/
│   │   └── plugin.json              ← 插件 manifest（位置错误）
│   ├── skills/
│   └── agents/
├── .claude-plugin/
│   └── marketplace.json             ← 格式不符合官方 schema
├── scripts/
│   └── validate-plugin.sh
└── README.md
```

### 目标结构（规范态）

```
baime/
├── plugin/                          ← 插件根目录（新增，参照 meta-cc/plugin-src/）
│   ├── .claude-plugin/
│   │   └── plugin.json              ← 从 .claude/.claude-plugin/ 迁移
│   ├── skills/                      ← 从 .claude/skills/ 迁移
│   │   └── <skill-name>/
│   │       ├── SKILL.md
│   │       ├── templates/
│   │       ├── examples/
│   │       └── reference/
│   └── agents/                      ← 从 .claude/agents/ 迁移
│       └── <agent-name>.md
│
├── .claude-plugin/
│   └── marketplace.json             ← 修正为官方 schema，source: "./plugin"
│
├── docs/
│   ├── proposals/
│   └── plans/
│
├── scripts/
│   ├── validate-plugin.sh           ← 更新路径引用
│   ├── release/
│   │   ├── release.sh               ← 新增：发布主脚本（简化版，无二进制构建）
│   │   ├── pre-release-check.sh     ← 新增：发布前检查
│   │   └── generate-changelog-entry.sh  ← 新增：自动生成 CHANGELOG 条目
│   └── install/
│       ├── install.sh               ← 新增：用户安装脚本
│       └── uninstall.sh             ← 新增：卸载脚本
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   ← 更新路径引用
│       └── release.yml              ← 新增：tag 触发，创建 GitHub Release
│
├── Makefile                         ← 新增：统一入口
├── CHANGELOG.md                     ← 新增
└── README.md                        ← 更新安装说明
```

---

## 关键文件格式

### `plugin/.claude-plugin/plugin.json`

```json
{
  "name": "baime",
  "version": "1.0.0",
  "description": "BAIME: Systematic methodology development with 19 validated skills and 6 specialized agents",
  "author": {
    "name": "Yale Huang",
    "url": "https://github.com/yaleh"
  },
  "license": "MIT",
  "homepage": "https://github.com/yaleh/baime",
  "repository": "https://github.com/yaleh/baime",
  "agents": [
    "stage-executor",
    "project-planner",
    "iteration-executor",
    "iteration-prompt-designer",
    "knowledge-extractor",
    "workflow-coach"
  ],
  "skills": [
    "agent-prompt-evolution",
    "api-design",
    "baseline-quality-assessment",
    "build-quality-gates",
    "ci-cd-optimization",
    "code-refactoring",
    "cross-cutting-concerns",
    "dependency-health",
    "documentation-management",
    "error-recovery",
    "knowledge-transfer",
    "methodology-bootstrapping",
    "next-step-generation",
    "observability-instrumentation",
    "rapid-convergence",
    "retrospective-validation",
    "subagent-prompt-construction",
    "technical-debt-management",
    "testing-strategy"
  ]
}
```

### `.claude-plugin/marketplace.json`

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "baime",
  "description": "BAIME (Bootstrapped AI Methodology Engineering) - systematic methodology development framework",
  "owner": {
    "name": "Yale Huang",
    "url": "https://github.com/yaleh"
  },
  "plugins": [
    {
      "name": "baime",
      "source": "./plugin",
      "version": "1.0.0",
      "description": "19 validated skills and 6 specialized agents for systematic AI methodology engineering via OCA cycles and dual-layer value functions",
      "license": "MIT",
      "homepage": "https://github.com/yaleh/baime",
      "category": "methodology",
      "tags": ["methodology", "engineering", "skills", "agents", "baime", "oca"]
    }
  ]
}
```

---

## 发布流程设计

### 简化版 release.sh（无二进制构建）

BAIME 是纯 Markdown，发布比 meta-cc 简单：无需跨平台编译、无需打包二进制、无需 smoke test 二进制。

```
release.sh v1.1.0 步骤：
  1. pre-release-check.sh
     ├─ git 工作区干净
     ├─ 在 main 分支
     ├─ tag 不重复
     ├─ plugin.json 与 marketplace.json 版本一致
     ├─ validate-plugin.sh 通过（JSON + YAML frontmatter + 计数）
     └─ CHANGELOG.md 包含目标版本条目

  2. 更新版本号
     ├─ plugin/.claude-plugin/plugin.json: version → 1.1.0
     └─ .claude-plugin/marketplace.json: plugins[0].version → 1.1.0

  3. 生成 CHANGELOG 条目（自动 or 手动）

  4. git add + git commit "chore: release v1.1.0"

  5. git tag -a v1.1.0

  6. git push origin main + git push origin v1.1.0

  7. GitHub Actions release.yml 触发
     ├─ validate-plugin.sh
     └─ 创建 GitHub Release（附带 CHANGELOG 摘录）
```

### Makefile 目标（参照 meta-cc 3-tier 模式）

```makefile
# 开发
validate          # 运行 validate-plugin.sh
install-local     # 本项目本地安装（--plugin-dir ./plugin 等效）
install-user      # 用户级安装（写入 ~/.claude/settings.json）
uninstall-user    # 卸载用户级安装

# 发布
bump-version      # VERSION=v1.1.0 更新版本号
pre-release-check # 发布前检查
release           # VERSION=v1.1.0 完整发布流程

# CI
check-push-ready  # 完整验证（validate + 格式检查）
```

### GitHub Actions release.yml（简化版）

```yaml
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - validate plugin (scripts/validate-plugin.sh)
      - extract CHANGELOG entry for this version
      - create GitHub Release
          body: CHANGELOG 条目
          files: （可选）plugin/ 目录 tar.gz
```

---

## 安装方式（目标态）

### 方式 1：Claude Code 原生（推荐）

```bash
/plugin marketplace add yaleh/baime
/plugin install baime@baime
```

### 方式 2：install.sh 快速安装

```bash
git clone https://github.com/yaleh/baime
cd baime
./scripts/install/install.sh
```

`install.sh` 核心逻辑（参照 meta-cc install-user，约 40 行）：
- `rsync -a plugin/ ~/.local/share/baime/`
- 写入 `~/.local/share/baime/.claude-plugin/marketplace.json`（source: "."）
- 追加 `extraKnownMarketplaces` 和 `enabledPlugins` 到 `~/.claude/settings.json`
- 清除 plugin cache

### 方式 3：本地开发测试

```bash
claude --plugin-dir ./plugin
```

---

## 实施优先级

### Phase 1：目录重组（解锁安装，P0）

1. 新建 `plugin/` 目录
2. 迁移 `.claude/agents/` → `plugin/agents/`
3. 迁移 `.claude/skills/` → `plugin/skills/`
4. 迁移 `.claude/.claude-plugin/plugin.json` → `plugin/.claude-plugin/plugin.json`
5. 修正 `.claude-plugin/marketplace.json` 为官方 schema
6. 更新 `scripts/validate-plugin.sh` 路径
7. 更新 `.github/workflows/ci.yml` 路径
8. 本地用 `claude --plugin-dir ./plugin` 验证
9. 提交，打 `v1.0.0` tag

### Phase 2：发布基础设施（P1）

1. 新增 `CHANGELOG.md`（补写 v1.0.0 条目）
2. 新增 `scripts/release/release.sh`（参照 meta-cc 简化版）
3. 新增 `scripts/release/pre-release-check.sh`
4. 新增 `scripts/install/install.sh` + `uninstall.sh`
5. 新增 `Makefile`（validate / install-user / release 等目标）
6. 新增 `.github/workflows/release.yml`

### Phase 3：可见性扩展（P2）

1. 通过 `clau.de/plugin-directory-submission` 提交至 `claude-plugins-official`
2. 提交至 `hesreallyhim/awesome-claude-code` 列表

---

## 与 meta-cc 的对比

| 方面 | meta-cc | BAIME（目标） | 差异原因 |
|------|---------|-------------|---------|
| 插件内容 | Go 二进制 + Markdown | 纯 Markdown | 无编译步骤 |
| 跨平台打包 | 5 平台 tar.gz | 不需要 | 无二进制 |
| release.yml 复杂度 | ~200 行（含编译、打包、smoke test） | ~50 行（仅验证 + GitHub Release） | 大幅简化 |
| install.sh | 需要放置二进制 | 仅 rsync + settings.json | 更简单 |
| 版本文件数量 | 2（plugin.json + marketplace.json） | 2（相同） | 对齐 |
| Makefile 规模 | ~700 行 | ~100 行 | 仅需要发布/安装相关目标 |
