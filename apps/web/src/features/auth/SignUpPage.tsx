import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { useUserStore } from '../../global/stores/useUserStore'
import { toErrorMessage } from '../../global/lib/api'

export function SignUpPage() {
  const status = useUserStore((state) => state.status)
  const signUp = useUserStore((state) => state.signUp)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  if (status === 'signedIn') return <Navigate to="/" replace />

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signUp({ name: name.trim(), email: email.trim(), password })
      setDone(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6 rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-sm">
        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-xl bg-(--success)/10 px-3 py-2.5 text-sm text-(--success)">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>
                Account created. We sent a verification link to{' '}
                <strong>{email.trim() || email}</strong>. Click it, then sign in.
              </span>
            </div>
            <Button onClick={() => (window.location.hash = '#/sign-in')}>Go to sign in</Button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-1 text-sm text-(--text-muted)">
                Takes a minute, keeps your notes safe and synced.
              </p>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl bg-(--danger)/10 px-3 py-2.5 text-sm text-(--danger)">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <Field label="Name">
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password" hint="At least 8 characters.">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Button
                type="submit"
                disabled={pending || !name.trim() || !email.trim() || password.length < 8}
              >
                {pending ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-(--text-muted)">
              Already have an account?{' '}
              <Link className="text-(--accent) hover:underline" to="/sign-in">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}