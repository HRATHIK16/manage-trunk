import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card panel" onSubmit={submit}>
        <div className="login__brand">
          <span className="sidebar__mark">◆</span>
          <span>Trunkline</span>
        </div>
        <p className="login__sub">Sign in to manage SIP trunks.</p>

        <label className="field">
          <span>Username</span>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>

        {error && <div className="form__error">{error}</div>}

        <button className="btn btn--primary login__submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
