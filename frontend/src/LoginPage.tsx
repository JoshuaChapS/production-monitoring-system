import { useState } from 'react'
import type { AuthUser } from './types'
import { API_URL } from './config'

interface LoginPageProps {
  onLogin: (user: AuthUser) => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = () => {
    if (!username || !password) {
      setError('Enter your username and password')
      return
    }
    setLoading(true)
    setError('')

    fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false)
        if (data.token) {
          localStorage.setItem('auth', JSON.stringify(data))
          onLogin(data)
        } else {
          setError('Invalid credentials')
        }
      })
      .catch(() => {
        setLoading(false)
        setError('Could not connect to server')
      })
  }

  const fieldClass =
    'w-full bg-field text-ink rounded border border-rim px-3 py-2 text-sm ' +
    'placeholder:text-faint focus:outline-none focus:border-azure transition-colors'

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-full max-w-xs px-6">

        <div className="mb-8">
          <h1 className="text-sm font-semibold text-ink">Production Monitor</h1>
          <p className="text-dim text-xs mt-0.5">CIB Technology</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-dim text-xs font-medium block mb-1.5">
              Username
            </label>
            <input
              type="text"
              className={fieldClass}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-dim text-xs font-medium block mb-1.5">
              Password
            </label>
            <input
              type="password"
              className={fieldClass}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-alert text-xs">{error}</p>
          )}

          <button
            className="w-full bg-azure-deep text-ink font-medium py-2 rounded text-sm
              hover:opacity-90 transition-opacity disabled:opacity-40"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default LoginPage
