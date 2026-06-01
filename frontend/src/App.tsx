import { useState, useEffect } from 'react'
import TicketCard from './TicketCard'
import LoginPage from './LoginPage'
import TeamPanel from './TeamPanel'
import type { Ticket, AuthUser } from './types'
import { API_URL } from './config'

function App() {
  const [auth, setAuth]           = useState<AuthUser | null>(null)
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open')
  const [showAll, setShowAll]     = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('auth')
    if (saved) setAuth(JSON.parse(saved))
  }, [])

  const fetchTickets = (token: string) => {
    fetch(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setTickets(data) })
  }

  useEffect(() => {
    if (!auth) return
    fetchTickets(auth.token)
    const interval = setInterval(() => fetchTickets(auth.token), 5000)
    return () => clearInterval(interval)
  }, [auth])

  const handleLogin  = (user: AuthUser) => setAuth(user)
  const handleLogout = () => {
    localStorage.removeItem('auth')
    setAuth(null)
    setTickets([])
  }

  if (!auth) return <LoginPage onLogin={handleLogin} />

  const openTickets     = tickets.filter(t => t.status === 'open')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved')
  const visibleResolved = showAll ? resolvedTickets : resolvedTickets.slice(0, 4)
  const visibleTickets  = activeTab === 'open' ? openTickets : visibleResolved

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-sm font-semibold text-ink tracking-tight">
              Production Monitoring
            </h1>
            <p className="text-dim text-xs mt-0.5">CIB Technology</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-dim text-xs">{auth.username}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${
              auth.role === 'manager'
                ? 'bg-azure-tint text-azure'
                : 'bg-field text-dim'
            }`}>
              {auth.role}
            </span>
            <button
              onClick={handleLogout}
              className="text-faint hover:text-alert text-xs transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {auth.role === 'developer' && auth.team && (
          <p className="text-dim text-xs -mt-4 mb-6">
            <span className="text-faint">Team:</span> {auth.team}
          </p>
        )}

        {/* Team management — managers only */}
        {auth.role === 'manager' && (
          <div className="mb-8">
            <TeamPanel token={auth.token} />
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-8 mb-8">
          <div>
            <p className="text-2xl font-semibold text-alert tabular-nums font-mono">
              {openTickets.length}
            </p>
            <p className="text-dim text-xs mt-0.5">Active incidents</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-ok tabular-nums font-mono">
              {resolvedTickets.length}
            </p>
            <p className="text-dim text-xs mt-0.5">Resolved today</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-rim mb-6">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'open'
                ? 'border-alert text-alert'
                : 'border-transparent text-faint hover:text-dim'
            }`}
          >
            Active ({openTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'resolved'
                ? 'border-ok text-ok'
                : 'border-transparent text-faint hover:text-dim'
            }`}
          >
            Resolved ({resolvedTickets.length})
          </button>
        </div>

        {/* Ticket list */}
        {visibleTickets.length === 0 ? (
          <p className="text-faint text-xs text-center py-16">
            {activeTab === 'open' ? 'No active incidents.' : 'No resolved tickets.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {visibleTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                {...ticket}
                token={auth.token}
                role={auth.role}
                onResolve={() => fetchTickets(auth.token)}
                onAssigned={() => fetchTickets(auth.token)}
              />
            ))}
          </div>
        )}

        {activeTab === 'resolved' && resolvedTickets.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-3 text-faint hover:text-dim text-xs transition-colors mt-1"
          >
            {showAll ? 'Show fewer' : `Show all ${resolvedTickets.length} resolved`}
          </button>
        )}

      </div>
    </div>
  )
}

export default App
