import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { resetPassword } from '../../global/repositories/auth.repository'
import { toErrorMessage } from '../../global/lib/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!token) setError('This link is missing a reset token. Please request a new one.')
  }, [token])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!token) return
    setPending(true)
    setError(null)
    try {
      await resetPassword(token, password)
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
        <div>
          <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-(--text-muted)">At least 8 characters.</p>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl bg-(--danger)/10 px-3 py-2.5 text-sm text-(--danger)">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-xl bg-(--success)/10 px-3 py-2.5 text-sm text-(--success)">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              Password updated.
            </div>
            <Button onClick={() => navigate('/sign-in')}>Go to sign in</Button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <Field label="New password">
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button
              type="submit"
              disabled={pending || password.length < 8 || confirm.length < 8}
            >
              {pending ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}