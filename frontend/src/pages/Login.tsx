import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBanner } from '../components/ui'

export function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@school.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'teacher' ? '/' : '/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <div className="title" style={{ fontWeight: 700, fontSize: 16 }}>Acacia College</div>
            <div className="sub">School Management &amp; Accounting</div>
          </div>
        </div>
        <h2>Sign in</h2>
        <div className="sub">Use your staff account to continue.</div>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy || loading}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-hint">
          Demo accounts:<br />
          <code>admin@school.com / admin123</code> (Administrator)<br />
          <code>bursar@school.com / bursar123</code> (Bursar)<br />
          <code>teacher@school.com / teacher123</code> (Teacher)<br />
          <code>headmaster@school.com / headmaster123</code> (Headmaster)
        </div>
      </div>
    </div>
  )
}