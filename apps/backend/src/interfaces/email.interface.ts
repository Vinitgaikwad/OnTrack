export type EmailSender = {
  send: (input: { to: string; subject: string; html: string }) => Promise<void>
}

export type EmailLinkBuilder = {
  verifyAccount: (token: string) => string
  resetPassword: (token: string) => string
}