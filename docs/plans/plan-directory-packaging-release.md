# Plan: 目录重组、打包与发布机制

- **对应 Proposal**: `docs/proposals/proposal-directory-packaging-release.md`
- **执行方式**: 每个 Stage 由独立 Task Agent 执行，完成后提交再进入下一 Stage

---

## Stage 1：目录重组与 manifest 修正

**目标**: 将插件内容从 `.claude/` 迁移到标准 `plugin/` 目录，修正两个 manifest 文件格式，使 `--plugin-dir ./plugin` 可正常加载。

### 任务

**1.1 创建目标目录结构**

```
mkdir -p plugin/.claude-plugin
```

**1.2 迁移插件内容（git mv）**

```bash
git mv .claude/agents plugin/agents
git mv .claude/skills  plugin/skills
git mv .claude/.claude-plugin/plugin.json plugin/.claude-plugin/plugin.json
```

迁移后删除空目录：
```bash
rmdir .claude/.claude-plugin
rmdir .claude
```

> 注意：如 `.claude/` 下还有其他文件（如 settings.json、worktrees/），单独处理，不迁移。

**1.3 更新 `plugin/.claude-plugin/plugin.json`**

在迁移后的文件基础上，补充 `author`、`license`、`homepage`、`repository` 字段，格式参照 proposal：

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
  "agents": [ ... ],
  "skills": [ ... ]
}
```

**1.4 修正 `.claude-plugin/marketplace.json`**

替换为官方 schema 格式：

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

**1.5 更新 `scripts/validate-plugin.sh` 路径引用**

将所有路径从 `.claude/` 前缀改为 `plugin/`：
- `AGENTS_DIR` → `$REPO_ROOT/plugin/agents`
- `SKILLS_DIR` → `$REPO_ROOT/plugin/skills`
- `PLUGIN_JSON` → `$REPO_ROOT/plugin/.claude-plugin/plugin.json`
- `MARKETPLACE_JSON` → `$REPO_ROOT/.claude-plugin/marketplace.json`（不变）

**1.6 更新 `.github/workflows/ci.yml`**

确认 validate-plugin.sh 的路径引用已通过 1.5 修正，CI 无需额外改动（validate-plugin.sh 内部使用 REPO_ROOT 推导路径）。

### 验收标准

```bash
# 1. validate-plugin.sh 通过
bash scripts/validate-plugin.sh
# 期望：ALL CHECKS PASSED，Agents: 6, Skills: 19

# 2. plugin.json 可被 jq 解析，且字段完整
jq '.name, .version, .author.name' plugin/.claude-plugin/plugin.json
# 期望："baime" "1.0.0" "Yale Huang"

# 3. marketplace.json 符合官方结构
jq '.plugins[0].source' .claude-plugin/marketplace.json
# 期望："./plugin"

# 4. plugin/ 目录结构正确
ls plugin/agents/ | wc -l    # 期望：6
ls plugin/skills/ | wc -l    # 期望：19

# 5. .claude/ 目录不再包含 agents/ 或 skills/
[ ! -d .claude/agents ] && [ ! -d .claude/skills ] && echo "OK"
```

### 提交

```
git add -A
git commit -m "refactor: migrate plugin content to plugin/ directory

Move agents, skills, and plugin.json from .claude/ to plugin/.
Fix marketplace.json to comply with official schema.
Update validate-plugin.sh path references.

Resolves: plugin cannot be loaded via --plugin-dir or /plugin marketplace add"
```

---

## Stage 2：Makefile 与安装脚本

**目标**: 提供 `make validate`、`make install-user`、`make uninstall-user` 命令，让开发者和用户能一条命令完成安装/卸载。

### 任务

**2.1 新增 `scripts/install/install.sh`**

参照 meta-cc `install-user` 逻辑，约 50 行：

```bash
#!/bin/bash
# 安装 baime plugin 到用户 scope
set -e

INSTALL_DIR="$HOME/.local/share/baime"
SETTINGS="$HOME/.claude/settings.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"

# 1. 复制 plugin/ 到 ~/.local/share/baime/
rsync -a --delete "$(dirname "$0")/../../plugin/" "$INSTALL_DIR/"

# 2. 生成 ~/.local/share/baime/.claude-plugin/marketplace.json（source: "."）
mkdir -p "$INSTALL_DIR/.claude-plugin"
cat > "$INSTALL_DIR/.claude-plugin/marketplace.json" << EOF
{
  "name": "$MARKETPLACE_NAME",
  "owner": {"name": "Yale Huang"},
  "plugins": [{"name": "$PLUGIN_NAME", "source": "."}]
}
EOF

# 3. 追加 extraKnownMarketplaces + enabledPlugins 到 ~/.claude/settings.json
mkdir -p "$HOME/.claude"
[ ! -f "$SETTINGS" ] && echo '{}' > "$SETTINGS"
jq --arg dir "$INSTALL_DIR" \
   --arg key "${PLUGIN_NAME}@${MARKETPLACE_NAME}" \
   '. + {
     extraKnownMarketplaces: ((.extraKnownMarketplaces // {}) + {($ENV.MARKETPLACE_NAME): {"source": {"source": "directory", "path": $dir}}}),
     enabledPlugins: ((.enabledPlugins // {}) + {($key): true})
   }' "$SETTINGS" > /tmp/baime-settings-tmp.json \
   && mv /tmp/baime-settings-tmp.json "$SETTINGS"

# 4. 清除 plugin cache
rm -rf "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}/"

echo "✅ baime installed. Restart Claude Code to activate."
```

**2.2 新增 `scripts/install/uninstall.sh`**

```bash
#!/bin/bash
# 卸载 baime plugin（用户 scope）
set -e

INSTALL_DIR="$HOME/.local/share/baime"
SETTINGS="$HOME/.claude/settings.json"
PLUGIN_NAME="baime"
MARKETPLACE_NAME="baime"

rm -rf "$INSTALL_DIR"

if [ -f "$SETTINGS" ]; then
  jq 'del(.extraKnownMarketplaces[$ENV.MARKETPLACE_NAME])
      | del(.enabledPlugins["\($ENV.PLUGIN_NAME)@\($ENV.MARKETPLACE_NAME)"])' \
     "$SETTINGS" > /tmp/baime-settings-tmp.json \
  && mv /tmp/baime-settings-tmp.json "$SETTINGS"
fi

rm -rf "$HOME/.claude/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}/"

echo "✅ baime uninstalled."
```

**2.3 新增 `Makefile`**

```makefile
REPO_ROOT := $(shell pwd)
PLUGIN_DIR := $(REPO_ROOT)/plugin

.PHONY: validate install-user uninstall-user bump-version pre-release-check release help

validate:
	@bash scripts/validate-plugin.sh

install-user:
	@bash scripts/install/install.sh

uninstall-user:
	@bash scripts/install/uninstall.sh

bump-version:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make bump-version VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/bump-version.sh $(VERSION)

pre-release-check:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make pre-release-check VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/pre-release-check.sh $(VERSION)

release:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/release.sh $(VERSION)

help:
	@echo "Targets:"
	@echo "  validate             - Run plugin validation"
	@echo "  install-user         - Install plugin to user scope"
	@echo "  uninstall-user       - Uninstall plugin from user scope"
	@echo "  bump-version VERSION=vX.Y.Z   - Update version in manifests"
	@echo "  pre-release-check VERSION=vX.Y.Z - Run pre-release checks"
	@echo "  release VERSION=vX.Y.Z        - Full release (checks + tag + push)"
```

### 验收标准

```bash
# 1. validate 目标正常
make validate
# 期望：ALL CHECKS PASSED

# 2. install-user 完成
make install-user
ls ~/.local/share/baime/agents/ | wc -l   # 期望：6
ls ~/.local/share/baime/skills/ | wc -l   # 期望：19
jq '.enabledPlugins' ~/.claude/settings.json | grep baime
# 期望：包含 "baime@baime": true

# 3. uninstall-user 干净移除
make uninstall-user
[ ! -d ~/.local/share/baime ] && echo "dir removed OK"
jq '.enabledPlugins' ~/.claude/settings.json | grep -c baime || echo "entry removed OK"

# 4. help 输出正常
make help
```

### 提交

```
git add Makefile scripts/install/
git commit -m "feat: add Makefile and install/uninstall scripts

Add make validate, install-user, uninstall-user targets.
install.sh copies plugin/ to ~/.local/share/baime and
registers marketplace in ~/.claude/settings.json."
```

---

## Stage 3：发布脚本与 CHANGELOG

**目标**: 建立完整发布流程——`pre-release-check.sh` 把关，`release.sh` 自动化版本更新和 git 操作，`CHANGELOG.md` 记录历史。

### 任务

**3.1 新增 `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-03-13

### Added
- Initial release: 19 validated skills covering methodology, testing, CI/CD,
  error recovery, documentation, API design, and more
- 6 specialized agents: project-planner, stage-executor, iteration-executor,
  iteration-prompt-designer, knowledge-extractor, workflow-coach
- Standard Claude Code plugin structure (plugin/ directory)
- Self-hosted marketplace via .claude-plugin/marketplace.json
- install.sh / uninstall.sh for user-scope installation
```

**3.2 新增 `scripts/release/pre-release-check.sh`**

7 项检查（参照 meta-cc，去掉二进制相关）：

```
检查项：
  1. git 工作区干净（无 uncommitted 变更）
  2. 当前在 main 分支
  3. 目标 tag 不已存在
  4. plugin.json 与 marketplace.json 版本号一致
  5. validate-plugin.sh 通过（JSON 合法 + YAML frontmatter + 计数断言）
  6. CHANGELOG.md 包含目标版本条目（如 [1.1.0]）
  7. jq 可用（脚本依赖）
```

**3.3 新增 `scripts/release/bump-version.sh`**

```bash
# 同步更新两个文件的版本号
# plugin/.claude-plugin/plugin.json: .version
# .claude-plugin/marketplace.json: .plugins[0].version
```

**3.4 新增 `scripts/release/release.sh`**

5 步流程（无二进制构建，参照 meta-cc 简化）：

```
Step 1: pre-release-check.sh（可 --skip-checks 绕过）
Step 2: bump-version.sh 更新两个 manifest
Step 3: 更新/验证 CHANGELOG.md（含目标版本条目）
Step 4: git add + git commit "chore: release vX.Y.Z"
Step 5: git tag -a vX.Y.Z + git push origin main + push tag
```

支持 `--dry-run` 模式（不实际写文件/提交/推送，只打印操作）。

### 验收标准

```bash
# 1. pre-release-check 在干净状态下通过（对当前 v1.0.0）
bash scripts/release/pre-release-check.sh v1.0.0
# 期望：所有检查通过

# 2. bump-version 正确同步版本
bash scripts/release/bump-version.sh v1.0.1
jq '.version' plugin/.claude-plugin/plugin.json          # 期望："1.0.1"
jq '.plugins[0].version' .claude-plugin/marketplace.json # 期望："1.0.1"
# 还原：git checkout -- plugin/.claude-plugin/plugin.json .claude-plugin/marketplace.json

# 3. release --dry-run 输出正确步骤
bash scripts/release/release.sh v1.0.1 --dry-run
# 期望：打印 6 步操作，无实际文件变更

# 4. make release dry-run（通过 Makefile 入口）
make release VERSION=v1.0.1
# （需手动确认：上面 dry-run 通过后，才执行实际 release）
```

### 提交

```
git add CHANGELOG.md scripts/release/
git commit -m "feat: add release scripts and CHANGELOG

Add pre-release-check.sh (7 validation gates), bump-version.sh,
release.sh (5-step release with --dry-run support).
Add CHANGELOG.md with v1.0.0 initial release entry."
```

---

## Stage 4：GitHub Actions release.yml

**目标**: 推送 `v*` tag 时自动触发，运行 validate，从 CHANGELOG 提取本次版本条目，创建 GitHub Release。

### 任务

**4.1 新增 `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    name: Create GitHub Release
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install PyYAML
        run: pip install pyyaml

      - name: Validate plugin
        run: bash scripts/validate-plugin.sh

      - name: Extract version from tag
        id: version
        run: echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"

      - name: Extract CHANGELOG entry
        id: changelog
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          # 提取 ## [VERSION] 到下一个 ## 之间的内容
          ENTRY=$(awk "/^## \[$VERSION\]/{found=1; next} found && /^## /{exit} found{print}" CHANGELOG.md)
          # 多行输出处理
          {
            echo "entry<<EOF"
            echo "$ENTRY"
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: "v${{ steps.version.outputs.version }}"
          body: |
            ## What's Changed

            ${{ steps.changelog.outputs.entry }}

            ---
            **Install:**
            ```
            /plugin marketplace add yaleh/baime
            /plugin install baime@baime
            ```
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
```

**4.2 更新 `README.md` 安装说明**

在 README 中补充两种安装方式：

```markdown
## Installation

### Via Claude Code (recommended)

```bash
/plugin marketplace add yaleh/baime
/plugin install baime@baime
```

### Via install script

```bash
git clone https://github.com/yaleh/baime
cd baime && ./scripts/install/install.sh
```

Restart Claude Code after installation.
```

### 验收标准

```bash
# 1. release.yml 语法合法（本地 lint）
# 可用 actionlint 或 yamllint 检查，或直接看 CI 结果

# 2. ci.yml 在 push 时仍然正常触发 validate-plugin.sh
#    （无需额外操作，validate-plugin.sh 路径已在 Stage 1 修正）

# 3. 整体流程端到端验证（在 Stage 3 完成后执行）
make release VERSION=v1.0.1
# 期望：
#   - git tag v1.0.1 创建
#   - git push 成功
#   - GitHub Actions release workflow 触发
#   - GitHub Release 页面出现 v1.0.1，body 包含 CHANGELOG 条目
```

### 提交

```
git add .github/workflows/release.yml README.md
git commit -m "feat: add release.yml GitHub Actions workflow

Trigger on v* tags: validate plugin, extract CHANGELOG entry,
create GitHub Release with install instructions."
```

---

## 阶段依赖关系

```
Stage 1（目录重组）
  └─► Stage 2（Makefile + 安装脚本）
        └─► Stage 3（发布脚本 + CHANGELOG）
              └─► Stage 4（GitHub Actions）
                    └─► 执行 make release VERSION=v1.0.1（完整端到端验证）
```

每个 Stage 完成后独立提交，验收标准全部通过后才进入下一 Stage。

---

## Task Agent 执行指令模板

每个 Stage 启动时，向 Task Agent 提供如下上下文：

```
工作目录：/home/yale/work/baime
参考文档：docs/proposals/proposal-directory-packaging-release.md
参考项目：/home/yale/work/meta-cc（同类插件的成熟实现，可读取作为参照）

任务：执行 plan-directory-packaging-release.md 中的 Stage N
  - 严格按照 Stage N 的「任务」列表执行
  - 完成后运行「验收标准」中的所有命令，确认全部通过
  - 按照「提交」部分的 commit message 格式提交
  - 不要跨越到 Stage N+1
```
