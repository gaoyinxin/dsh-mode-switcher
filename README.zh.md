# @gaoyinxin/dsh-mode-switcher

[English](README.md) | 中文

像 Claude Code 一样通过 `Tab` 键或工具栏按钮快速切换 **Plan** 和 **Build** 模式，并支持为不同模式预设不同的模型（例如 Plan 用 Pro，Build 用 Flash）。

## 功能特性

- **键盘快捷键切换**：
  - 在输入框中随时按 `Tab` 键（无论是否已输入文字），立即在 `Build` 和 `Plan` 模式间平滑切换，完全不丢失已输入的草稿文本和光标位置。
  - 当 `@` 引用或 `/` 命令自动补全菜单弹出时，自动让位给补全选择。
- **工具栏统一控制按钮**：
  - 通过优先级遮蔽（`priority: -10`）接管 `conversation.input.plan` 槽位，替代原生单向的「计划」关闭按钮，避免按钮重复。
  - 常驻展示 `[ 🛠️ Build ⇥ Tab ]` / `[ 📋 Plan ⇥ Tab ]` 状态，点击即可切换。
- **模式与模型无缝联动**：
  - 默认使用当前会话的模型与 Provider，切换模式时不改变用户当前选定的模型。
  - 点击按钮右侧的 `⚙️` 图标，可自由为 Plan 和 Build 模式指定特定的预设模型（例如 Plan 固定用 Pro/Reasoner，Build 固定用 Flash）；若未指定则自动跟随当前模型。
  - 配置持久化于本地浏览器（v2 存储），随时可在弹窗中还原为跟随当前模型。
- **原生双语支持**：
  - 界面与设置弹窗自动识别系统语言，支持英文（English）与简体中文无缝切换。

## 安装方式

### 方式一：通过 DSH 插件市场（推荐）
1. 在 DSH 设置的 **插件 -> 发现** 中，点击 **管理索引源 -> 添加索引源**。
2. 输入市场索引地址：
   ```text
   https://gaoyinxin.github.io/dsh-mode-switcher/index.json
   ```
3. 在市场列表中搜索 **Mode Switcher**，点击 **安装** 即可。

### 方式二：命令行安装
```bash
dsh plugin add git+https://github.com/gaoyinxin/dsh-mode-switcher.git#v1.0.0
```
