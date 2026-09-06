import type { EmailLinkBuilder, EmailSender } from '../interfaces/email.interface'

const FROM = 'OnTrack <onboarding@email.vinitprj.xyz>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function createEmailSender(apiKey: string): EmailSender {
  return {
    async send({ to, subject, html }) {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to, subject, html }),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Resend rejected email (${response.status}): ${detail}`)
      }
    },
  }
}

export function createEmailLinkBuilder(webUrl: string): EmailLinkBuilder {
  return {
    verifyAccount: (token) => `${webUrl}/#/verify-email?token=${token}`,
    resetPassword: (token) => `${webUrl}/#/reset-password?token=${token}`,
  }
}

const layout = (title: string, content: string) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fff8f0;font-family:Arial,sans-serif;color:#2d1b0e">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8f0;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="460" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ebd4b0;border-radius:16px;padding:32px">
            <tr><td align="center" style="font-size:22px;font-weight:bold;letter-spacing:0.5px;padding-bottom:8px">OnTrack</td></tr>
            <tr><td align="center" style="font-size:16px;font-weight:bold;padding-bottom:16px">${title}</td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#553a23">${content}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

const buttonStyles =
  'display:inline-block;background:#ff5c39;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold;margin:12px 0'

export function verificationEmailHtml(name: string, link: string): string {
  return layout(
    'Verify your email',
    `<p>Hi ${name},</p>
     <p>Welcome to OnTrack. Confirm your email to start using your account:</p>
     <p align="center"><a href="${link}" style="${buttonStyles}">Verify email</a></p>
     <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
  )
}

export function passwordResetEmailHtml(name: string, link: string): string {
  return layout(
    'Reset your password',
    `<p>Hi ${name},</p>
     <p>You asked to reset your password. Click below to choose a new one:</p>
     <p align="center"><a href="${link}" style="${buttonStyles}">Reset password</a></p>
     <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
  )
}