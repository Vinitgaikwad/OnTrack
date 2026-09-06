import type { Context } from 'hono'
import { z } from 'zod'
import { prismaClient } from '../db'
import { ok } from '../lib/http'
import { handle, validateBody, validateQuery } from '../lib/validate'
import * as authService from '../services/auth.service'

const emailSchema = z.string().trim().email('Enter a valid email address')
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128)
const nameSchema = z.string().trim().min(1, 'Name is required').max(60)

const signupSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
})

const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
})

const refreshSchema = z.object({ refreshToken: z.string().min(1) })

const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
})

const emailOnlySchema = z.object({ email: emailSchema })

const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid reset token'),
  newPassword: passwordSchema,
})

const verifyEmailQuerySchema = z.object({ token: z.string().min(32) })

export const handleSignup = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, signupSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const { user } = await authService.signup(db, {
      ...body.data,
      jwtSecret: c.env.JWT_SECRET,
      resendApiKey: c.env.RESEND_API_KEY,
      webUrl: c.env.WEB_URL,
    })
    return ok(c, { user }, 201)
  })

export const handleSignin = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, signinSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const session = await authService.signin(db, { ...body.data, jwtSecret: c.env.JWT_SECRET })
    return ok(c, session)
  })

export const handleRefresh = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, refreshSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const session = await authService.refresh(db, { ...body.data, jwtSecret: c.env.JWT_SECRET })
    return ok(c, session)
  })

export const handleSignout = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.signout(db, c.get('userId'))
  })

export const handleMe = (c: Context) =>
  handle(c, async () => {
    const db = prismaClient(c.env.DATABASE_URL)
    const user = await authService.me(db, c.get('userId'))
    return ok(c, user)
  })

export const handleUpdateProfile = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, updateProfileSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    const user = await authService.updateProfile(db, c.get('userId'), body.data)
    return ok(c, user)
  })

export const handleChangePassword = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, changePasswordSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.changePassword(db, c.get('userId'), body.data)
  })

export const handleVerifyEmail = (c: Context) =>
  handle(c, async () => {
    const query = validateQuery(c, verifyEmailQuerySchema)
    if (!query.ok) return query.response
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.verifyEmail(db, query.data.token)
  })

export const handleResendVerification = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, emailOnlySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.resendVerificationEmail(db, {
      email: body.data.email,
      resendApiKey: c.env.RESEND_API_KEY,
      webUrl: c.env.WEB_URL,
    })
    return ok(c, { message: 'If the account exists, a verification link has been sent.' })
  })

export const handleForgotPassword = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, emailOnlySchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.forgotPassword(db, {
      email: body.data.email,
      resendApiKey: c.env.RESEND_API_KEY,
      webUrl: c.env.WEB_URL,
    })
    return ok(c, { message: 'If the account exists, a reset link has been sent.' })
  })

export const handleResetPassword = (c: Context) =>
  handle(c, async () => {
    const body = await validateBody(c, resetPasswordSchema)
    if (!body.ok) return body.response
    const db = prismaClient(c.env.DATABASE_URL)
    await authService.resetPassword(db, body.data)
  })