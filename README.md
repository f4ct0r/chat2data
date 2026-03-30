# Chat2Data

Chat2Data 是一个面向桌面的、AI 驱动的数据库聊天与分析工具。它希望把自然语言问答、SQL 编辑、多数据源连接和结果预览整合到同一个工作台中，让分析、探索和验证数据的过程更直接。

当前仓库处于早期探索阶段。项目已经具备一套可演进的 Electron 应用结构和核心能力雏形，但整体产品仍在持续打磨中。

## Why Chat2Data

在真实的数据分析流程里，用户通常需要在多个工具之间来回切换：

- 用数据库客户端管理连接和执行 SQL
- 用文档或聊天工具整理分析思路
- 用 BI 或表格工具查看结果
- 用 AI 工具辅助生成、解释或修正查询

Chat2Data 想解决的问题，是把这些高频动作收敛到一个桌面应用里，让用户可以围绕“理解数据并完成分析”这件事连续工作，而不是把时间花在工具切换上。

## Project Vision

Chat2Data 的目标不是只做一个“会生成 SQL 的聊天框”，而是成为一个更完整的数据工作台：

- 用自然语言描述问题，获得可执行的分析建议
- 在 SQL 编辑器中继续控制、修改和验证查询
- 连接不同类型的数据库，用统一体验浏览结构和执行结果
- 在 AI 辅助和人工判断之间保持清晰边界，避免黑盒式的数据操作

## Current Capabilities

从当前代码结构来看，项目已经覆盖了以下几个方向：

- AI 聊天与上下文组装
- SQL 补全与查询建议
- 查询执行与结果预览
- 数据库连接管理
- 多种数据库适配器
- 标签页式工作区
- 查询历史、对象浏览和基础设置界面
- 凭据存储与 SQL 安全分类相关能力

当前已集成或预留支持的数据库类型包括：

- MySQL
- PostgreSQL
- SQL Server
- ClickHouse
- SQLite

## Project Status

这是一个公开中的早期探索版项目。

这意味着：

- 项目方向已经明确
- 核心模块已经开始落地
- 功能、界面和交互仍会持续调整
- 文档、安装体验和发布流程还会继续完善

如果你正在浏览这个仓库，可以把它理解为一个正在成形的产品原型，而不是已经稳定发布的成熟版本。

## Tech Stack

项目当前主要基于以下技术构建：

- Electron
- React
- TypeScript
- Vite
- Vitest
- Ant Design
- Monaco Editor
- Zustand

数据库访问和执行层使用了对应数据库驱动，并在 `src/core/db/adapters` 下按类型拆分实现。

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

平台定向构建：

```bash
npm run build:mac
npm run build:win
```

### macOS DMG Packaging Notes

仓库现在默认支持两种 macOS 打包模式：

- 未配置 Apple 签名身份时：生成可分发的未签名 `.dmg`
- 配置了签名身份时：生成已签名 `.dmg`

当前构建配置会自动检测以下环境：

- `CSC_LINK` 或 `CSC_NAME`：用于启用 macOS 代码签名
- `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`
- 或 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`

如果只配置了签名身份但没有配置公证凭据，构建会继续执行，但产物只会签名，不会被公证。

构建产物默认输出到 `release/` 目录，例如：

```bash
release/Chat2Data-1.0.0-arm64.dmg
```

打包前还会执行一次数据库文件守卫脚本。以下文件模式如果出现在仓库工作目录或 `dist/` 构建输入中，构建会直接失败，避免被误打包进安装包：

- `*.sqlite`
- `*.sqlite3`
- `*.db`
- `*.db3`
- `*-wal`
- `*-shm`

## Project Structure

```text
src/
  main/        Electron 主进程与应用生命周期
  preload/     安全桥接层
  renderer/    React 渲染层与桌面界面
  core/        数据库访问、查询执行、Agent 与安全逻辑
  shared/      跨进程共享的类型、常量与协议
```

其中几个关键模块包括：

- `src/core/db`：连接管理与数据库适配器
- `src/core/executor`：SQL 执行与结果标准化
- `src/core/agent`：聊天代理、上下文装配、Schema 索引与补全建议
- `src/core/security`：凭据处理与 SQL 安全分类
- `src/renderer/components`：桌面界面组件

## Development Notes

项目当前采用 TypeScript，并保持主进程、预加载层、渲染层和核心逻辑分层组织。测试主要覆盖以下方向：

- 数据库连接管理
- 查询执行逻辑
- Agent 上下文与补全能力
- 凭据服务与 SQL 分类
- 渲染层关键交互与状态管理

如果你准备参与开发，建议优先关注 `src/core/` 和 `src/renderer/` 下的模块边界。

## Roadmap

接下来项目会继续沿这些方向推进：

- 完善聊天驱动的数据分析工作流
- 强化 SQL 生成、补全和解释能力
- 补齐连接配置、结果展示与错误反馈体验
- 继续扩展测试覆盖率和稳定性
- 打磨安装、打包和发布流程
- 持续改进文档与开源协作体验

## Contributing

欢迎通过 Issue 或 Pull Request 参与项目讨论与建设。

在提交变更前，请至少完成以下检查：

- 确保改动范围清晰、可解释
- 为核心逻辑补充或更新测试
- 本地运行 `npm test`

如果改动涉及数据库连接、安全策略或敏感信息处理，请在说明中明确标出影响范围。

## License

本项目采用 Apache License 2.0 许可证发布。详见根目录 [LICENSE](/Users/f4ct0r/Programs/git/chat2data/LICENSE)。
