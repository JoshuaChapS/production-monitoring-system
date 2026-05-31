import { useState } from 'react'
import type { AuthUser } from './types'

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
      setError('Please enter username and password')
      return
    }
    setLoading(true)
    setError('')

    fetch('http://localhost:8080/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false)
        if (data.token) {
          // Guardar en localStorage para que sobreviva refreshes
          localStorage.setItem('auth', JSON.stringify(data))
          onLogin(data)
        } else {
          setError('Invalid username or password')
        }
      })
      .catch(() => {
        setLoading(false)
        setError('Could not connect to server')
      })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm border border-gray-700">

        <h1 className="text-2xl font-bold text-white mb-1">Production Monitor</h1>
        <p className="text-gray-400 text-sm mb-8">CIB Technology — JP Morgan</p>

        <div className="mb-4">
          <label className="text-gray-400 text-sm block mb-1">Username</label>
          <input
            type="text"
            className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="mb-6">
          <label className="text-gray-400 text-sm block mb-1">Password</label>
          <input
            type="password"
            className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <button
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded transition-colors disabled:opacity-50"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

      </div>
    </div>
  )
}

export default LoginPage