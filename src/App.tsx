import { useState, useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { UserAvatar } from './components/UserAvatar'
import { SettingsPanel } from './components/SettingsPanel'
import { NodeDetailView } from './components/NodeDetailView'
import { IdeaDialog } from './components/IdeaDialog'
import { ThemeProvider } from './components/ThemeProvider'
import { useAppStore } from './stores/appStore'
import { Node } from './types'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [ideaDialogNode, setIdeaDialogNode] = useState<Node | null>(null)
  const { ui, setSidebarOpen, nodes, addNode, addEdge } = useAppStore()
  const theme = ui.theme

  // 添加测试节点和边 (只在首次加载时执行)
  useEffect(() => {
    // 严格检查：只有在nodes为空且未初始化时才执行
    const hasInitialized = sessionStorage.getItem('app-initialized')
    if (nodes.length === 0 && !hasInitialized) {
      console.log('[App] Initializing test data...')

      sessionStorage.setItem('app-initialized', 'true')

      // 创建测试项目
      const testProjectId = 'test-project-1'

      // 添加测试节点
      const testNode1: Node = {
        id: 'node-1',
        projectId: testProjectId,
        theme: '机器学习基础',
        summary: '介绍机器学习的基本概念、类型和应用场景',
        contentMd: `# 机器学习基础

## 一、什么是机器学习

机器学习是人工智能的一个重要分支，它让计算机能够从数据中学习并做出预测或决策，而无需显式编程。

### 核心概念

机器学习的核心在于让算法从数据中自动学习模式和规律。通过训练数据，算法可以：

- **识别模式**：发现数据中的规律和趋势
- **做出预测**：基于历史数据预测未来结果
- **自动化决策**：根据学习到的知识进行智能决策

## 二、机器学习类型

### 监督学习 (Supervised Learning)

监督学习使用标记的训练数据来训练模型。每个训练样本都包含输入特征和对应的正确输出。

\`\`\`python
# 监督学习示例：线性回归
import numpy as np
from sklearn.linear_model import LinearRegression

# 训练数据
X = np.array([[1], [2], [3], [4], [5]])  # 输入特征
y = np.array([2, 4, 6, 8, 10])        # 目标值

# 创建和训练模型
model = LinearRegression()
model.fit(X, y)

# 预测新值
prediction = model.predict([[6]])
print(f"预测结果: {prediction[0]}")  # 输出: 12.0
\`\`\`

### 无监督学习 (Unsupervised Learning)

无监督学习处理未标记的数据，旨在发现数据中的隐藏结构。

### 强化学习 (Reinforcement Learning)

强化学习通过试错学习最优策略，强调与环境的交互。

## 三、应用场景

### 1. 图像识别
- 人脸识别
- 物体检测
- 医学影像分析

### 2. 自然语言处理
- 机器翻译
- 情感分析
- 聊天机器人

### 3. 推荐系统
- 商品推荐
- 内容个性化
- 用户行为预测

## 四、机器学习流程

1. **数据收集**：获取相关的数据集
2. **数据预处理**：清洗和转换数据
3. **特征工程**：选择和构造特征
4. **模型选择**：选择合适的算法
5. **模型训练**：使用训练数据训练模型
6. **模型评估**：验证模型性能
7. **模型部署**：将模型应用于实际问题

## 五、常用工具和框架

### Python 生态系统
- **NumPy**：数值计算
- **Pandas**：数据处理
- **Scikit-learn**：经典机器学习算法
- **TensorFlow**：深度学习框架
- **PyTorch**：深度学习框架

### 其他语言
- **R**：统计分析和机器学习
- **Julia**：高性能数值计算

## 六、挑战与未来

### 当前挑战
- **数据质量**：高质量标注数据的获取成本高
- **模型解释性**：复杂模型的决策过程难以理解
- **计算资源**：深度学习需要大量计算资源

### 未来发展
- **自动化机器学习 (AutoML)**
- **联邦学习 (Federated Learning)**
- **边缘计算中的机器学习**
- **多模态学习**

通过不断学习和实践，你将能够掌握机器学习的核心概念和技术，为解决现实世界的复杂问题奠定基础。`,
        toc: [
          { level: 1, text: '机器学习基础', anchor: 'h1-机器学习基础' },
          { level: 2, text: '一、什么是机器学习', anchor: 'h2-一、什么是机器学习' },
          { level: 3, text: '核心概念', anchor: 'h3-核心概念' },
          { level: 2, text: '二、机器学习类型', anchor: 'h2-二、机器学习类型' },
          { level: 3, text: '监督学习 (Supervised Learning)', anchor: 'h3-监督学习-(Supervised-Learning)' },
          { level: 3, text: '无监督学习 (Unsupervised Learning)', anchor: 'h3-无监督学习-(Unsupervised-Learning)' },
          { level: 3, text: '强化学习 (Reinforcement Learning)', anchor: 'h3-强化学习-(Reinforcement-Learning)' },
          { level: 2, text: '三、应用场景', anchor: 'h2-三、应用场景' },
          { level: 3, text: '1. 图像识别', anchor: 'h3-1-图像识别' },
          { level: 3, text: '2. 自然语言处理', anchor: 'h3-2-自然语言处理' },
          { level: 3, text: '3. 推荐系统', anchor: 'h3-3-推荐系统' },
          { level: 2, text: '四、机器学习流程', anchor: 'h2-四、机器学习流程' },
          { level: 2, text: '五、常用工具和框架', anchor: 'h2-五、常用工具和框架' },
          { level: 3, text: 'Python 生态系统', anchor: 'h3-Python-生态系统' },
          { level: 3, text: '其他语言', anchor: 'h3-其他语言' },
          { level: 2, text: '六、挑战与未来', anchor: 'h2-六、挑战与未来' },
          { level: 3, text: '当前挑战', anchor: 'h3-当前挑战' },
          { level: 3, text: '未来发展', anchor: 'h3-未来发展' }
        ],
        annotations: [],
        favorites: false,
        animations: [],
        position: { x: 100, y: 100 },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        status: 'completed',
      }

      const testNode2: Node = {
        id: 'node-2',
        projectId: testProjectId,
        theme: '监督学习',
        summary: '详细讲解监督学习算法和应用',
        contentMd: '# 监督学习\n\n监督学习使用标记的训练数据...',
        toc: [],
        annotations: [],
        favorites: false,
        animations: [],
        position: { x: 400, y: 100 },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        status: 'completed',
      }

      const testNode3: Node = {
        id: 'node-3',
        projectId: testProjectId,
        theme: '神经网络',
        summary: '深度学习和神经网络的工作原理',
        contentMd: '# 神经网络\n\n神经网络模拟人脑神经元...',
        toc: [],
        annotations: [],
        favorites: false,
        animations: [],
        position: { x: 250, y: 300 },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        status: 'completed',
      }

      // 立即添加节点
      addNode(testNode1)
      addNode(testNode2)
      addNode(testNode3)

      // 使用requestAnimationFrame确保在下一帧添加边
      requestAnimationFrame(() => {
        console.log('[App] Adding test edges...')
        addEdge({
          id: 'edge-1',
          projectId: testProjectId,
          fromNodeId: 'node-1',
          toNodeId: 'node-2',
          fromAnchor: 'bottom',
          toAnchor: 'top',
          meta: {},
        })

        addEdge({
          id: 'edge-3',
          projectId: testProjectId,
          fromNodeId: 'node-1',
          toNodeId: 'node-3',
          fromAnchor: 'bottom',
          toAnchor: 'top',
          meta: {},
        })

        console.log('[App] Test data initialization complete')
      })
    }
  }, []) // 空依赖数组，只在组件挂载时执行一次

  return (
    <ThemeProvider theme={theme}>
      <div className="h-screen w-screen overflow-hidden bg-background">
        {/* 主画布区域 */}
        {!settingsOpen && !selectedNode && <Canvas onNodeDoubleClick={setSelectedNode} onNodeIdeaClick={setIdeaDialogNode} />}

        {/* 侧边栏抽屉 - 始终渲染，确保在所有界面都可见 */}
        <Sidebar isOpen={ui.sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* 工具栏 - 始终渲染，确保在所有界面都可见 */}
        <Toolbar />

        {/* 用户头像按钮 */}
        {!settingsOpen && !selectedNode && <UserAvatar onSettingsClick={() => setSettingsOpen(true)} />}

        {/* 设置界面 */}
        {settingsOpen && (
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        )}

        {/* 节点详情界面 */}
        {selectedNode && (
          <NodeDetailView
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* 联想推荐对话框 */}
        {ideaDialogNode && (
          <IdeaDialog
            node={ideaDialogNode}
            isOpen={!!ideaDialogNode}
            onClose={() => setIdeaDialogNode(null)}
          />
        )}

        {/* 全局覆盖层 - 用于模态框等 */}
        <div id="modal-root" />
      </div>
    </ThemeProvider>
  )
}

export default App