# NexLearn - AI 自学辅助工具

基于无限画布的AI辅助学习工具，支持智能知识生成、联想推荐和思维导图构建。

## ✨ 核心功能

- 🖼️ **无限画布** - 支持缩放、平移的知识图谱编辑器
- 🤖 **AI内容生成** - OpenAI GPT-4 或 Ollama 本地模型驱动
- 🔍 **智能检索** - Bing/Google 联网搜索集成
- 💡 **联想推荐** - AI生成相关知识点并自动构建子节点
- 📝 **富文本编辑** - Markdown渲染和代码高亮
- 🗺️ **思维导图** - 自动生成和可编辑的知识结构图
- 🔒 **隐私保护** - 支持本地模型，完全离线使用

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn
- Ollama (可选，用于本地AI模型)

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
npm install
```

### 配置环境变量

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑配置
# 使用OpenAI
LLM_PROVIDER=openai

# 或使用Ollama本地模型
LLM_PROVIDER=ollama
```

## 配置

### LLM 服务配置

#### 使用 OpenAI (云端模式)
```bash
# backend/.env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
```

#### 使用 Ollama (本地模式)
```bash
# 1. 安装 Ollama: https://ollama.com/download
# 2. 启动 Ollama 服务
ollama serve

# 3. 拉取模型
ollama pull llama2  # 或其他模型

# 4. 配置环境变量
# backend/.env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

### 搜索服务配置 (可选)

```bash
# backend/.env
BING_SEARCH_API_KEY=your_bing_api_key
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id
```

## 启动

### 开发模式

```bash
# 前端 (终端1)
npm run dev

# 后端 (终端2) - 支持环境变量热重载
cd backend
npm run dev

# 修改 .env 文件后，服务会自动重启并加载新配置
```

### Ollama 本地模型设置

```bash
# 1. 安装 Ollama
# https://ollama.com/download

# 2. 启动 Ollama 服务
ollama serve

# 3. 下载模型 (例如 DeepSeek)
ollama pull deepseek-v3.1

# 4. 配置环境变量
# backend/.env
LLM_PROVIDER=ollama
OLLAMA_MODEL=deepseek-v3.1
```

### 生产构建

```bash
# 前端构建
npm run build

# 后端构建
cd backend
npm run build
npm start
```

## 使用指南

### 创建知识节点

1. **右键画布空白区域** → 选择"添加节点"
2. **输入节点主题** → 如"机器学习基础"
3. **点击生成** → AI自动联网检索并生成教程内容
4. **等待生成完成** → 节点显示蓝色表示成功

### 联想学习

1. **点击节点上的联想按钮** (第四个按钮)
2. **AI生成相关知识点** → 显示推荐列表
3. **选择感兴趣的主题** → 可多选
4. **点击创建** → 自动生成子节点并建立连接

### 浏览内容

1. **双击节点** → 进入详情页面
2. **左侧目录导航** → 点击跳转到指定章节
3. **全屏/普通视图切换** → 右上角按钮

## 🎯 架构特色

### 前端技术栈
- **React 18** + TypeScript - 现代化前端框架
- **PIXI.js** - 高性能Canvas渲染引擎
- **Zustand** - 轻量级状态管理
- **Tailwind CSS** - 实用优先的样式系统

### 后端技术栈
- **Express.js** + TypeScript - RESTful API服务
- **多LLM支持** - OpenAI / Ollama无缝切换
- **搜索集成** - Bing/Google API支持
- **安全防护** - Helmet + Rate Limiting

### 数据模型
- **节点树结构** - 支持无限层级
- **边连接关系** - 父子节点自动关联
- **Markdown内容** - 富文本知识存储
- **思维导图数据** - 可视化知识结构

## 🔧 开发

### 项目结构

```
nexlearn/
├── src/                    # 前端源代码
│   ├── components/         # React组件
│   ├── lib/               # 工具库
│   ├── stores/            # 状态管理
│   └── types/             # TypeScript类型
├── backend/               # 后端服务
│   ├── src/
│   │   ├── routes/        # API路由
│   │   ├── services/      # 业务服务
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   └── package.json
└── README.md
```

### 核心组件

- **Canvas** - 无限画布渲染引擎
- **Node** - 知识节点组件
- **Edge** - 节点连接线
- **LLMService** - AI服务集成
- **SearchService** - 搜索服务
- **IdeaDialog** - 联想推荐界面

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙋‍♂️ 支持

如果您在使用过程中遇到问题：

1. 查看 [Issues](../../issues) 页面
2. 查看 [Discussions](../../discussions) 页面
3. 提交新的 Issue

## 🎉 致谢

感谢以下开源项目和服务的支持：

- [OpenAI](https://openai.com/) - GPT模型提供
- [Ollama](https://ollama.com/) - 本地LLM支持
- [PIXI.js](https://pixijs.com/) - Canvas渲染引擎
- [React](https://reactjs.org/) - 前端框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式系统

---

**NexLearn** - 让学习变得更智能、更高效！ 🚀