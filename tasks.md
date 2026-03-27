- [x] Implement LLM API key settings UI (OpenAI/Anthropic) using Ant Design. Add safeStorage for keys in src/core/security/credential-service.ts. Add IPC channels for saving/getting API keys. Add privacy consent dialog on first use.

- [x] Task 3: Chat Agent Core Integration. Integrate OpenAI and Anthropic API calls in src/core/agent/chat-agent.ts using node-fetch or native fetch. Define system prompts for SQL generation. Create IPC handlers in main.ts.

- [x] Task 4: Agent Chat UI Panel. Build chat interface with input and messages list in src/renderer/components/Chat/ChatPanel.tsx. Render user messages, agent reasoning, and generated SQL. Connect to IPC window.api.agent.generateSql.

- [x] Task 5: Security Controller & Execution Routing. Create SQL risk classifier in src/core/security/sql-classifier.ts. Add dangerous operation confirmation dialog in UI (SqlWorkspace). Auto-execute read-only queries from Agent, show inline in ChatPanel.
