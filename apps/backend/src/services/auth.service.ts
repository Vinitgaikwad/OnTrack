import { compare, hash } from 'bcryptjs'
import type { PrismaClient } from '../generated/prisma/client'
import { AppError } from '../lib/http'
import { signAccessToken } from '../lib/jwt'
import { digestToken, randomToken } from '../lib/tokens'
import { createEmailSender, createEmailLinkBuilder, passwordResetEmailHtml, verificationEmailHtml } from './email.service'

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const PASSWORD_ROUNDS = 12

export type SafeUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: string
}

export type AuthSession = {
  user: SafeUser
  accessToken: string
  /** access token lifetime in seconds */
  expiresIn: number
  refreshToken: string
}

type UserWithTokens = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: Date
}

const toSafeUser = (user: UserWithTokens): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt.toISOString(),
})

const normalizeEmail = (email: string) => email.trim().toLowerCase()

type EmailContext = { resendApiKey: string; webUrl: string }

const mail = (ctx: EmailContext) => ({
  sender: createEmailSender(ctx.resendApiKey),
  links: createEmailLinkBuilder(ctx.webUrl),
})

interface VerificationMailInput {
  to: string
  name: string
  token: string
}
interface ResetMailInput {
  to: string
  name: string
  token: string
}

const sendVerificationMail = async (ctx: EmailContext, input: VerificationMailInput): Promise<void> => {
  const { sender, links } = mail(ctx)
  await sender.send({
    to: input.to,
    subject: 'Verify your OnTrack email',
    html: verificationEmailHtml(input.name, links.verifyAccount(input.token)),
  })
}

const sendResetMail = async (ctx: EmailContext, input: ResetMailInput): Promise<void> => {
  const { sender, links } = mail(ctx)
  await sender.send({
    to: input.to,
    subject: 'Reset your OnTrack password',
    html: passwordResetEmailHtml(input.name, links.resetPassword(input.token)),
  })
}

async function issueSession(db: PrismaClient, user: UserWithTokens, jwtSecret: string): Promise<AuthSession> {
  const accessToken = await signAccessToken(user.id, jwtSecret)
  const refreshToken = randomToken()
  const refreshTokenDigest = await digestToken(refreshToken)
  await db.user.update({
    where: { id: user.id },
    data: { refreshTokenDigest, refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
  })
  return {
    user: toSafeUser(user),
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
    refreshToken,
  }
}

export async function signup(
  db: PrismaClient,
  input: { email: string; name: string; password: string; jwtSecret: string } & EmailContext
): Promise<{ user: SafeUser }> {
  const email = normalizeEmail(input.email)
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.', 409)
  }

  const passwordHash = await hash(input.password, PASSWORD_ROUNDS)
  const user = await db.user.create({
    data: { email, name: input.name.trim(), passwordHash },
  })

  const token = randomToken()
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
  await db.emailVerificationToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, token, expiresAt },
    update: { token, expiresAt },
  })

  void sendVerificationMail(input, { to: email, name: user.name, token }).catch((err) => {
    console.error('[ontrack] verification email failed', err)
  })

  return { user: toSafeUser(user) }
}

export async function signin(
  db: PrismaClient,
  input: { email: string; password: string; jwtSecret: string }
): Promise<AuthSession> {
const user = await db.user.findUnique({ where: { email: normalizeEmail(input.email) } })
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)
  }
  const valid = await compare(input.password, user.passwordHash)
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)
  }
  if (!user.emailVerified) {
    throw new AppError('EMAIL_UNVERIFIED', 'Please verify your email before signing in.', 403)
  }
  return issueSession(db, user, input.jwtSecret)
}

export async function refresh(
  db: PrismaClient,
  input: { refreshToken: string; jwtSecret: string }
): Promise<AuthSession> {
  if (!input.refreshToken) {
    throw new AppError('UNAUTHORIZED', 'Missing refresh token.', 401)
  }
  const digest = await digestToken(input.refreshToken)
  const user = await db.user.findUnique({ where: { refreshTokenDigest: digest } })
  if (!user || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() < Date.now()) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token.', 401)
  }
  return issueSession(db, user, input.jwtSecret)
}

export async function signout(db: PrismaClient, userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { refreshTokenDigest: null, refreshTokenExpiresAt: null },
  })
}

export async function me(db: PrismaClient, userId: string): Promise<SafeUser> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('NOT_FOUND', 'User not found.', 404)
  return toSafeUser(user)
}

export async function updateProfile(
  db: PrismaClient,
  userId: string,
  patch: { name?: string; avatarUrl?: string | null }
): Promise<SafeUser> {
  const data: { name?: string; avatarUrl?: string | null } = {}
  if (patch.name !== undefined) data.name = patch.name.trim()
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl
  const user = await db.user.update({ where: { id: userId }, data })
  return toSafeUser(user)
}

export async function changePassword(
  db: PrismaClient,
  userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('UNAUTHORIZED', 'Not authenticated.', 401)
  const valid = await compare(input.currentPassword, user.passwordHash)
  if (!valid) throw new AppError('INVALID_PASSWORD', 'Current password is incorrect.', 400)
  const passwordHash = await hash(input.newPassword, PASSWORD_ROUNDS)
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, refreshTokenDigest: null, refreshTokenExpiresAt: null },
  })
}

export async function verifyEmail(db: PrismaClient, token: string): Promise<void> {
  const record = await db.emailVerificationToken.findUnique({ where: { token } })
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new AppError('INVALID_VERIFICATION', 'Invalid or expired verification link.', 400)
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    db.emailVerificationToken.delete({ where: { id: record.id } }),
  ])
}

export async function resendVerificationEmail(
  db: PrismaClient,
  input: { email: string } & EmailContext
): Promise<void> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(input.email) } })
  if (!user) return
  const token = randomToken()
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
  await db.emailVerificationToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, token, expiresAt },
    update: { token, expiresAt },
  })
  await sendVerificationMail(input, { to: user.email, name: user.name, token })
}

export async function forgotPassword(
  db: PrismaClient,
  input: { email: string } & EmailContext
): Promise<void> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(input.email) } })
  if (!user) return
  const token = randomToken()
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  await db.passwordResetToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, token, expiresAt },
    update: { token, expiresAt },
  })
  await sendResetMail(input, { to: user.email, name: user.name, token })
}

export async function resetPassword(
  db: PrismaClient,
  input: { token: string; newPassword: string }
): Promise<void> {
  const record = await db.passwordResetToken.findUnique({ where: { token: input.token } })
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired reset link.', 400)
  }
  const passwordHash = await hash(input.newPassword, PASSWORD_ROUNDS)
  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash, refreshTokenDigest: null, refreshTokenExpiresAt: null },
    }),
    db.passwordResetToken.delete({ where: { id: record.id } }),
  ])
}