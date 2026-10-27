# @gaoyinxin/dsh-mode-switcher

English | [中文](README.zh.md)

Switch seamlessly between **Plan** and **Build** modes in DeepSeek Harness via `Tab` key or toolbar button like Claude Code, with customizable per-mode model presets (e.g. Pro for Plan, Flash for Build).

## Features

- **Keyboard Shortcut Toggle**:
  - Press `Tab` at any time while typing in the composer (whether empty or with drafted text) to smoothly toggle between `Build` and `Plan` modes without losing draft text or cursor position.
  - Automatically yields to `@` mention and `/` slash command popup menus.
- **Unified Toolbar Button**:
  - Overrides the `conversation.input.plan` slot via priority shadowing (`priority: -10`), replacing the native one-way "Plan" close chip and preventing duplicate buttons.
  - Persistently displays `[ 🛠️ Build ⇥ Tab ]` / `[ 📋 Plan ⇥ Tab ]` status; click to toggle.
- **Seamless Model Presets**:
  - Defaults to using the session's currently selected model and provider without changing models on mode switch.
  - Click the `⚙️` settings icon next to the toggle button to configure custom models for Plan and Build modes (e.g. fix Plan to Pro/Reasoner and Build to Flash/Chat); leaves as "Follow current model" if unconfigured.
  - Persisted in local browser storage (v2 format).
- **Native Bilingual Support**:
  - Fully supports English and Simplified Chinese UI and settings, automatically adapting to the browser's display language.

## Installation

### Method 1: Via DSH Plugin Market (Recommended)
1. In DeepSeek Harness Settings, navigate to **Plugins -> Discover**.
2. Click **Manage Index Sources… -> Add Index Source**.
3. Enter the market index URL:
   ```text
   https://gaoyinxin.github.io/dsh-mode-switcher/index.json
   ```
4. Search for **Mode Switcher** in the market list and click **Install**.

### Method 2: Via Command Line
```bash
dsh plugin add git+https://github.com/gaoyinxin/dsh-mode-switcher.git#v1.0.0
```
