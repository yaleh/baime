# Proposal: Plugin Distribution via Self-Hosted Marketplace

## 背景

BAIME 当前以单次提交方式发布（Phase 41），包含 6 个 Agent、19 个 Skill，均为纯 Markdown 内容，无二进制或 MCP 依赖。

目前存在两个阻塞用户安装的问题：

1. **目录结构不符合官方规范**：Claude Code 要求 `plugin.json` 位于插件根目录的 `.claude-plugin/` 下，而当前 `plugin.json` 在 `.claude/.claude-plugin/`，`marketplace.json` 在 repo 根的 `.claude-plugin/`，两者均无法被标准安装流程正确识别。

2. **`marketplace.json` 格式错误**：缺少官方 schema 要求的 `$schema`、`owner`、`plugins[]` 数组等字段，无法被 `/plugin marketplace add` 识别。

## 目标

- 用户能够通过一条命令完成安装
- 支持版本化发布与 CHANGELOG
- 为后续提交 `claude-plugins-official` 官方市场打好结构基础

## 方案：自建 Marketplace（Self-Hosted）

### 安装方式（目标态）

```
/plugin marketplace add yaleh/baime
/plugin install baime@baime
```

或直接一步（如 marketplace 里设置 `autoEnable`）：

```
/plugin install baime@baime
```

### 官方标准目录结构

根据 [Create plugins 官方文档](https://code.claude.com/docs/en/plugins)，插件根目录结构为：

```
<plugin-root>/
├── .claude-plugin/
│   └── plugin.json        ← 插件 manifest（必须）
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── agents/
│   └── <agent-name>.md
├── commands/              ← 可选
├── hooks/                 ← 可选
├── .mcp.json              ← 可选
└── settings.json          ← 可选
```

根据 [Create and distribute a plugin marketplace 官方文档](https://code.claude.com/docs/en/plugin-marketplaces)，marketplace 文件位于：

```
<repo-root>/
└── .claude-plugin/
    └── marketplace.json   ← marketplace catalog（必须）
```

### 建议的 BAIME 目录重组方案

当前结构（❌ 不符合规范）：

```
baime/
├── .claude/                        ← 当前插件内容混在此处
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   └── agents/
├── .claude-plugin/
│   └── marketplace.json            ← 格式错误
└── scripts/
```

目标结构（✅ 符合官方规范）：

```
baime/
├── .claude-plugin/
│   └── marketplace.json            ← 修正格式，指向 plugin/ 目录
├── plugin/                         ← 插件根目录（新增）
│   ├── .claude-plugin/
│   │   └── plugin.json             ← 从 .claude/.claude-plugin/ 移入
│   ├── skills/                     ← 从 .claude/skills/ 移入
│   │   └── <skill-name>/
│   │       └── SKILL.md
│   └── agents/                     ← 从 .claude/.claude-plugin/ 移入
│       └── <agent-name>.md
├── docs/
│   ├── proposals/
│   └── plans/
├── scripts/
│   ├── validate-plugin.sh
│   └── release.sh                  ← 待新增
└── README.md
```

### marketplace.json 目标格式

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "baime",
  "description": "BAIME (Bootstrapped AI Methodology Engineering) - 19 validated skills and 6 specialized agents for systematic methodology development",
  "owner": {
    "name": "yaleh"
  },
  "plugins": [
    {
      "name": "baime",
      "description": "BAIME framework: systematic methodology development with OCA cycles, dual-layer value functions, and empirical validation",
      "version": "1.0.0",
      "source": "./plugin",
      "category": "methodology",
      "tags": ["methodology", "engineering", "skills", "agents", "baime"]
    }
  ]
}
```

### plugin.json 目标格式

```json
{
  "name": "baime",
  "version": "1.0.0",
  "description": "BAIME framework for systematic AI methodology engineering",
  "author": "yaleh",
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

## 实施步骤

### Phase 1：结构修正（阻塞安装，优先）

1. 新建 `plugin/` 目录
2. 将 `.claude/.claude-plugin/plugin.json` 移至 `plugin/.claude-plugin/plugin.json`
3. 将 `.claude/skills/` 移至 `plugin/skills/`
4. 将 `.claude/agents/` 移至 `plugin/agents/`
5. 修正 `.claude-plugin/marketplace.json` 为官方 schema 格式
6. 更新 `scripts/validate-plugin.sh` 的路径引用
7. 更新 `.github/workflows/ci.yml` 的路径引用

### Phase 2：发布基础设施（版本化发布）

1. 新增 `CHANGELOG.md`
2. 新增 `scripts/release.sh`（参照 meta-cc 模式，简化版）
3. 新增 `.github/workflows/release.yml`（tag 触发，创建 GitHub Release）
4. 打 `v1.0.0` tag

### Phase 3：官方市场提交（可选，扩大覆盖）

通过 `clau.de/plugin-directory-submission` 或 `platform.claude.com/plugins/submit` 提交至 `claude-plugins-official`。

提交后用户安装方式升级为：
```
/plugin install baime@claude-plugins-official
```

## 风险与注意事项

- `.claude/` 目录当前同时充当"项目本地配置"和"插件内容"两个角色，重组后两者分离，开发体验更清晰。
- `plugin/` 目录命名可根据偏好调整（如 `plugin-src/`），与 marketplace.json 中 `source` 字段保持一致即可。
- Phase 1 完成后需在本地用 `claude --plugin-dir ./plugin` 验证安装效果，再提交。
