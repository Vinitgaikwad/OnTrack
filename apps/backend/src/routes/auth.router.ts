import { Hono } from 'hono'
import { authVerify } from '../middleware/auth'
import * as ctrl from '../controllers/auth.controller'

const authRouter = new Hono()

authRouter.post('/signup', ctrl.handleSignup)
authRouter.post('/signin', ctrl.handleSignin)
authRouter.post('/refresh', ctrl.handleRefresh)
authRouter.get('/verify-email', ctrl.handleVerifyEmail)
authRouter.post('/verify-email/resend', ctrl.handleResendVerification)
authRouter.post('/forgot-password', ctrl.handleForgotPassword)
authRouter.post('/reset-password', ctrl.handleResetPassword)

authRouter.use('/me', authVerify)
authRouter.get('/me', ctrl.handleMe)
authRouter.patch('/me', ctrl.handleUpdateProfile)
authRouter.patch('/password', ctrl.handleChangePassword)
authRouter.post('/signout', authVerify, ctrl.handleSignout)

export default authRouter