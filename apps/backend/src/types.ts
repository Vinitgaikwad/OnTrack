export type Env = {
  DATABASE_URL: string
  JWT_SECRET: string
  RESEND_API_KEY: string
  WEB_URL: string
  OPENROUTER_API_KEY: string
  MODEL_KEY_ENCRYPTION_KEY: string
  INTEGRATION_ENCRYPTION_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
}

export type AppVariables = {
  userId: string
}