import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { forgotPassword } from '../../global/repositories/auth.repository'
import { toErrorMessage } from '../../global/lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setPending(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
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
          <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            Enter your email and we’ll send a reset link.
          </p>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl bg-(--danger)/10 px-3 py-2.5 text-sm text-(--danger)">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {sent ? (
          <div className="flex items-start gap-2 rounded-xl bg-(--success)/10 px-3 py-2.5 text-sm text-(--success)">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            If that account exists, a reset link is on its way.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Button
              onClick={() => void submit()}
              disabled={pending || !email.trim()}
            >
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
          </div>
        )}

        <Link className="text-center text-sm font-medium text-(--accent) hover:underline" to="/sign-in">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}