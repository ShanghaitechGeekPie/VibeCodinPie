# 🥧 Vibe Cod'in Pie

**AI 驱动的互动 Live Coding 音乐演出系统**

> GeekPie × Pi Day 2026 · ShanghaiTech University

Vibe Cod'in Pie 是一个让观众通过自然语言直接干预音乐进行的实时电子乐系统。观众只需扫码提出需求（如“让节奏快一点”、“加一点赛博朋克感的贝斯”），AI 就会在几秒钟内将需求转化为 [Strudel](https://strudel.cc) 代码，并实时注入大屏运行引擎。

## ✨ 核心特性

- **🤖 DeepSeek 驱动**：使用 DeepSeek-V3/Chat 模型，针对 Strudel (TidalCycles JS) 语法深度优化 Prompt 工程。
- **🔄 强一致性同步 (Pull Sync)**：服务器采用“按需拉取”模型。在每次 AI 生成前，实时向浏览器索要最新的代码状态，彻底杜绝“AI 基于旧代码修改”的问题。
- **📱 Material 3 移动端**：基于 Google Material Design v3 标准设计的观众端界面，支持动态状态通知（排队中、处理中、已应用）。
- **🛡️ 生产级稳定性**：
  - **AST 验证**：生成的代码经过 Acorn 解析校验，确保语法合法且不包含非法系统调用。
  - **自动重试**：AI 生成失败时自动原地重试。
  - **内容审核**：内置关键词过滤，预防不当内容提交。
- **🎹 预设切换**：支持即时切换多种音乐风格（Ambient, Techno, Glitch-Hop 等）。

## 🏗️ 系统架构

```
观众手机 (Mobile) ──WebSocket──→ Node.js 后端 ──WebSocket──→ 大屏浏览器 (Screen)
(Material 3 UI)        │        (Sync & AI Pipeline)         (Strudel Engine)
                       ├─> 1. 加入任务队列
                       ├─> 2. 向 Screen 拉取当前代码
                       ├─> 3. 调用 DeepSeek API
                       ├─> 4. AST 语法校验
                       └─> 5. 推送新代码并执行
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

创建 `.env` 文件并配置你的 DeepSeek API Key：

```ini
PORT=3000
HOST=0.0.0.0
DEEPSEEK_API_KEY=your_sk_key_here
AI_MODEL=deepseek-chat
```

### 3. 启动项目

```bash
# 开发环境（带热更新）
npm run dev

# 生产环境
npm start
```

## 🖥️ 现场部署建议

### 1. 访问路径
- **大屏显示端**：`http://[IP]:3000/` (展示代码、频谱及 QR 码)
- **观众互动端**：`http://[IP]:3000/submit` (扫码即跳转 — 服务器将观众端静态资源挂载在 `/submit` 路径)

### 2. 网络设置
- **同一局域网**：确保后端服务器、大屏浏览器和观众手机在同一子网下。
- **推荐拓扑**：服务器连接有线网以保证 DeepSeek API 访问速度；手机端通过高性能 WiFi 热点连接。

### 3. 音频设置
- 打开大屏页面后需要点击一次页面（或点击 "PLAY" 按钮）以激活浏览器的 Web Audio 上下文。

## 📁 项目结构

- `server/`: 核心逻辑
  - `index.js`: WebSocket 管理、代码同步协议、任务调度。
  - `ai.js`: DeepSeek API 接口及重试逻辑。
  - `prompts.js`: 针对音乐生成的系统提示词。
  - `validator.js`: 基于 AST 的 Strudel 安全验证器。
  - `queue.js`: 异步高效任务队列。
- `client/`: 前端资源
  - `screen.html`: 大屏视觉中心（Strudel 引擎 + 频谱可视化）。
  - `mobile/index.html`: Material 3 规范 a 观众端。

## 📄 开源许可

MIT License. Designed with ❤️ for GeekPie.
