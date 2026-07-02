import jwt from 'jsonwebtoken'

export function generateToken(id: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return jwt.sign({ id }, secret, { expiresIn: '30d' })
}