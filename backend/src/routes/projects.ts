import express from 'express'
import { body } from 'express-validator'
import { validateRequest } from '../middleware/validateRequest'
import { attachUser, requireAuth } from '../middleware/auth'
import { projectStore } from '../services/projectStorage'
import { AppError } from '../middleware/errorHandler'

const router = express.Router()

// 所有项目相关接口都要求登录用户
router.use(attachUser)
router.use(requireAuth)

// 获取当前用户最近一次打开的项目
router.get('/current', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = (req as any).currentUser
    if (!user?.id) throw new AppError('Unauthorized', 401)

    const project = projectStore.getCurrentForUser(user.id)

    res.json({
      success: true,
      data: {
        project: project || null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

// 保存当前项目（覆盖式保存）
router.put(
  '/current',
  [
    body('project').isObject().withMessage('Project payload is required'),
    validateRequest,
  ],
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = (req as any).currentUser
      if (!user?.id) throw new AppError('Unauthorized', 401)

      const rawProject = req.body.project || {}
      const id = typeof rawProject.id === 'string' && rawProject.id.trim().length > 0
        ? rawProject.id
        : `proj-${Date.now()}`

      // 后端只做轻量校验，结构完全透传给前端
      const saved = projectStore.saveForUser(user.id, {
        id,
        name: typeof rawProject.name === 'string' && rawProject.name.trim().length > 0
          ? rawProject.name
          : '默认项目',
        nodes: Array.isArray(rawProject.nodes) ? rawProject.nodes : [],
        edges: Array.isArray(rawProject.edges) ? rawProject.edges : [],
        settings: rawProject.settings && typeof rawProject.settings === 'object'
          ? rawProject.settings
          : {
              theme: 'light',
              defaultLanguage: 'zh-CN',
              autoSave: true,
              showGrid: true,
              snapToGrid: false,
            },
        metadata: rawProject.metadata || {},
        // 允许透传额外字段（例如导出标记等）
        ...rawProject,
      })

      res.json({
        success: true,
        data: {
          project: saved,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      next(error)
    }
  }
)

export default router

