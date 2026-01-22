import express from 'express'
import { validationResult } from 'express-validator'
import { AppError } from './errorHandler'

export const validateRequest = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400))
  }
  next()
}
