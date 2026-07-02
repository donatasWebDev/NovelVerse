import { Request } from 'express'

export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}