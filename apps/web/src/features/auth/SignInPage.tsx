import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { useUserStore } from '../../global/stores/useUserStore'
import { toErrorMessage } from '../../global/lib/api'

export function SignInPage() {
  const status = useUserStore((state) => state.status)
  const signIn = useUserStore((state) => state.signIn)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const needsVerification = error === 'Please verify your email before signing in.'

  if (status === 'signedIn') return <Navigate to="/" replace />

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate('/')
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6 rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-(--text-muted)">Sign in to pick up where you left off.</p>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl bg-(--danger)/10 px-3 py-2.5 text-sm text-(--danger)">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              {error}
              {needsVerification ? (
                <Link className="ml-1 underline underline-offset-2" to="/verify-email">
                  Resend verification
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" disabled={pending || !email.trim() || !password}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link className="text-(--accent) hover:underline" to="/sign-up">
            Create an account
          </Link>
          <Link className="text-(--text-muted) hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}