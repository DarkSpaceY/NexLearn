import { Request, Response, NextFunction } from 'express'

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): Response => {
  void next
  const error = {
    success: false,
    error: {
      message: `Not found - ${req.originalUrl}`,
      code: 'NOT_FOUND'
    },
    timestamp: new Date().toISOString()
  }

  return res.status(404).json(error)
}
