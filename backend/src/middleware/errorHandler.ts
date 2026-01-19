import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

// Custom error class
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.name = this.constructor.name

    Error.captureStackTrace(this, this.constructor)
  }
}

// Error response interface
interface ErrorResponse {
  success: false
  error: {
    message: string
    code?: string
    details?: any
  }
  timestamp: string
}

// Global error handler
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  void next
  let error = { ...err }
  error.message = err.message

  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = new AppError(message, 404)
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered'
    error = new AppError(message, 400)
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ')
    error = new AppError(message, 400)
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token'
    error = new AppError(message, 401)
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired'
    error = new AppError(message, 401)
  }

  // Send error response
  const statusCode = error instanceof AppError ? error.statusCode : 500

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: error.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    },
    timestamp: new Date().toISOString()
  }

  return res.status(statusCode).json(errorResponse)
}
