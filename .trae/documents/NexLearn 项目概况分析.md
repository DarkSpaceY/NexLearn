
通过对项目文件结构、配置文件 (`package.json`) 和文档 (`项目文档.md`, `architecture.md`) 的分析，我对 **NexLearn** 项目有了全面的了解。

### 1. 项目概览
**NexLearn** 是一个 **AI 辅助自学工具**，核心是一个基于 **无限画布** 的知识节点系统。它结合了思维导图、笔记和 AI 生成能力，帮助用户构建知识体系。

### 2. 技术栈
*   **前端**:
    *   **核心框架**: React 18, TypeScript, Vite
    *   **UI 组件**: Tailwind CSS, Radix UI
    *   **状态管理**: Zustand (配合 localforage 进行持久化)
    *   **画布渲染**: `src/components/canvas` 下同时存在 `PixiCanvas.tsx` (PixiJS) 和 `ReactFlowCanvas.tsx` (React Flow)，看似在进行技术选型或双轨支持。
    *   **Markdown**: React Markdown, Syntax Highlighter
*   **后端** (`backend/`):
    *   **运行时**: Node.js, Express
    *   **语言**: TypeScript
    *   **AI/LLM**: 依赖 `openai`, `ollama` 等库

### 3. 项目结构
*   **`src/`**: 前端源码
    *   `components/`: UI 组件 (Canvas, NodeDetailView, Sidebar 等)
    *   `stores/`: 全局状态管理 (`appStore.ts` 实现了完整的 CRUD 操作)
    *   `lib/`: 工具函数 (api, canvasUtils 等)
*   **`backend/`**: 后端服务
    *   `routes/`: API 路由 (nodes, search)
    *   `services/`: 业务逻辑 (llm, search)

### 4. 当前进度 (基于 `architecture.md` 和代码)
*   **Phase 1 (核心架构)**: 基本完成。
    *   [x] 项目搭建 & Canvas 基础
    *   [x] 数据模型 (Node, Edge, Project) 定义
    *   [x] 状态管理 (Zustand store 实现)
*   **Phase 2 (AI 集成)**: 部分代码存在 (后端有 LLM service)，但前端集成待确认。

### 5. 下一步建议
如果您准备开始开发，请告知您的具体目标。例如：
1.  **完善画布交互**: 确定使用 PixiJS 还是 React Flow，并优化节点拖拽/连接体验。
2.  **联调 AI 功能**: 打通前端与后端的 LLM 生成接口。
3.  **开发节点详情页**: 完善 `NodeDetailView.tsx` 的 Markdown 渲染和交互。
