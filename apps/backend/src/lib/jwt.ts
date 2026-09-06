import { SignJWT, jwtVerify } from 'jose'

const ALG = 'HS256'
const ACCESS_TOKEN_TTL = '15m'

export async function signAccessToken(userId: string, jwtSecret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(new TextEncoder().encode(jwtSecret))
}

export async function verifyAccessToken(token: string, jwtSecret: string): Promise<string> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), {
    algorithms: [ALG],
  })
  const userId = payload.sub
  if (!userId) throw new Error('Access token is missing subject')
  return userId
}