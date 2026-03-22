# Milestone 1: 基础设施与脚手架搭建 SPEC

## 1. 目标与范围

- **目标**：搭建应用底层框架，建立安全隔离的进程间通信机制，实现基础数据的本地 SQLite 存储与原生操作系统级别的凭据加密。
- **交付物**：一个可运行的 Electron + Vite + React 桌面应用骨架，具备基于类型安全的 IPC 调用闭环和本地 SQLite/加密模块测试能力。

## 2. 技术栈选型

- **桌面端框架**：Electron
- **前端构建**：Vite
- **渲染层**：React + TypeScript
- **本地数据库**：`better-sqlite3`（支持同步调用且在 Node.js 中性能极佳，适合 Electron 桌面应用）
- **加密方案**：Electron 原生 `safeStorage` API（自动对接 macOS Keychain 和 Windows Credential Vault）

## 3. 目录结构设计

遵循模块化隔离原则，严格区分主进程和渲染进程环境，禁止渲染层直接触碰 Node API：

```text
src/
├── main/       # Electron 主进程入口、窗口生命周期管理
├── renderer/   # React 渲染进程（UI 组件、页面）
├── preload/    # 预加载脚本（contextBridge，安全 API 桥梁）
├── core/       # 核心业务逻辑（数据库连接管理、SQLite 存储、Agent 编排）
└── shared/     # 共享的类型定义、IPC Channel 枚举、公共常量
```

## 4. IPC 通信机制设计

### 4.1 通信原则
- 采用基于 Promise 的 `ipcRenderer.invoke` 与 `ipcMain.handle` 进行异步通信。
- 所有 Channel 名称必须统一在 `src/shared/ipc-channels.ts` 中维护为枚举或常量。
- 严禁向渲染层暴露全能的 `ipcRenderer.send`。

### 4.2 暴露的全局 API 接口
在 `src/preload/index.ts` 中通过 `contextBridge` 注入以下安全接口：

```typescript
// src/shared/types.ts 预留参考
interface ElectronAPI {
  // 系统与窗口能力
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  // 存储与配置能力
  storage: {
    saveConnection: (config: ConnectionConfig) => Promise<string>;
    getConnections: () => Promise<ConnectionConfig[]>;
    deleteConnection: (id: string) => Promise<void>;
  };
  // 仅供测试的临时 Ping 接口
  system: {
    ping: () => Promise<string>;
  };
}
```

## 5. 本地存储与加密设计

### 5.1 SQLite 表结构 (Connections)
使用 `better-sqlite3` 在用户 `appData` 目录下初始化一个 `chat2data.sqlite` 文件。

```sql
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  db_type TEXT NOT NULL, -- 'mysql', 'postgres', 'mssql', 'clickhouse'
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  database TEXT,
  encrypted_password TEXT, -- 加密后的密码 Hex 字符串
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 安全凭据加密生命周期

为落实设计文档中的“明文密码不暴露给渲染层”的原则，加解密流程如下：

1. **保存凭据**：
   - Renderer 将明文密码随连接配置发给 Main。
   - Main 中的 `CredentialService` 检查 `safeStorage.isEncryptionAvailable()`。
   - 调用 `safeStorage.encryptString(password)` 加密为 Buffer，转换为 hex 字符串存入 `encrypted_password`。
2. **读取配置**：
   - 当 Renderer 请求连接列表时，Main 从 SQLite 读出记录。
   - 过滤掉真实密码，向 Renderer 返回一个脱敏对象，仅带 `hasPassword: true` 的标志位。
3. **建立连接时（下一里程碑）**：
   - 核心层的数据库引擎读取 SQLite 记录。
   - 将 `encrypted_password` 转回 Buffer，调用 `safeStorage.decryptString(buffer)` 还原为明文直接供底层数据库 Driver 使用。

## 6. 任务拆解与检查清单 (Tasks)

- [ ] **T1.1 初始化项目脚手架**
  - 使用 Vite (React+TS 模板) 搭配 Electron 构建初始工程。
  - 配置 TypeScript, ESLint, Prettier。
  - 建立上述定义的 5 个核心目录（`main`, `renderer`, `preload`, `core`, `shared`）。
- [ ] **T1.2 建立 IPC 类型安全桥梁**
  - 定义 `ipc-channels.ts` 常量。
  - 在 `preload` 脚本中实现并注入 `window.api`。
  - 编写一个简单的 `system.ping` 接口在前后端打通日志输出。
- [ ] **T1.3 引入本地存储与加密服务**
  - 安装 `better-sqlite3`，并配置相应的 native 编译环境（如 `electron-rebuild`）。
  - 实现 `src/core/storage/sqlite-service.ts` 负责数据库文件创建与建表。
  - 实现 `src/core/security/credential-service.ts` 封装 `safeStorage`。
- [ ] **T1.4 里程碑集成测试 (端到端验证)**
  - 在 Renderer 写一个简单的调试按钮："创建一条测试连接"。
  - 触发 IPC，将伪造的连接数据（含明文密码）发送给主进程。
  - 主进程将其加密后存入 SQLite。
  - 验证应用生成了 SQLite 库文件，并确认数据库里的密码字段已被成功加密。
