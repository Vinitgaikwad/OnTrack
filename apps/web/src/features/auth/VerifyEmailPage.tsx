import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../global/ui/Button'
import { Field, Input } from '../../global/ui/Field'
import { resendVerification, verifyEmail } from '../../global/repositories/auth.repository'
import { toErrorMessage } from '../../global/lib/api'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<'verifying' | 'success' | 'error' | 'idle'>('idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)

  const requestedRef = useRef(false)

  useEffect(() => {
    if (!token || requestedRef.current) return
    requestedRef.current = true
    setState('verifying')
    verifyEmail(token)
      .then(() => setState('success'))
      .catch((error) => {
        setMessage(toErrorMessage(error))
        setState('error')
      })
  }, [token])

  const resend = async () => {
    setPending(true)
    try {
      await resendVerification(email.trim())
      setMessage('If that account exists, a new link is on its way.')
      setState('success')
    } catch (error) {
      setMessage(toErrorMessage(error))
      setState('error')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6 rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Verify your email</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            {token ? 'Confirming that link…' : 'Resend the verification email.'}
          </p>
        </div>

        {token ? (
          <div className="flex items-start gap-2 rounded-xl bg-(--surface-2) px-3 py-2.5 text-sm text-(--text-muted)">
            <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
            {state === 'verifying' && <span>Verifying…</span>}
            {state === 'success' && (
              <span className="flex items-center gap-2 text-(--success)">
                <CheckCircle2 size={16} /> Email verified! You can sign in now.
              </span>
            )}
            {state === 'error' && (
              <span className="flex items-center gap-2 text-(--danger)">
                <AlertCircle size={16} /> {message}
              </span>
            )}
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void resend()
            }}
          >
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? 'Sending…' : 'Resend verification email'}
            </Button>
          </form>
        )}

        <button
          onClick={() => (window.location.hash = '#/sign-in')}
          className="text-sm font-medium text-(--accent) hover:underline"
        >
          Back to sign in
        </button>
      </div>
    </AuthLayout>
  )
}