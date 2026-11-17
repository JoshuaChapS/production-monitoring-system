import { useState, useEffect } from 'react'
import TicketCard from './TicketCard'
import LoginPage from './LoginPage'
import TeamPanel from './TeamPanel'
import type { Ticket, AuthUser } from './types'
import { apiFetch, loadAuth, saveAuth, onAuthChange } from './api'

function App() {
  // Start from the stored session, so a reload keeps the user logged in.
  const [auth, setAuth]           = useState<AuthUser | null>(loadAuth)
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open')
  const [showAll, setShowAll]     = useState(false)
  // Time of the last poll that really returned tickets, and whether the latest poll failed.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [pollFailed, setPollFailed]   = useState(false)

  // Register once: every saveAuth() in api.ts (login, refresh, forced logout) now updates this component.
  // Clearing everything on logout keeps the next user from briefly seeing the previous user's data.
  useEffect(() => {
    onAuthChange(next => {
      setAuth(next)
      if (!next) {
        setTickets([])
        setLastUpdated(null)
        setPollFailed(false)
      }
    })
    return () => onAuthChange(() => {})
  }, [])

  /**
   * Loads the ticket list through apiFetch, which handles an expired token by itself.
   * Any other failure (server down, an error status, a body that is not a ticket list) marks the poll
   * as failed so the dashboard says so, instead of silently showing old or empty data as current.
   */
  const fetchTickets = () => {
    apiFetch('/tickets')
      .then(res => {
        if (!res.ok) throw new Error(`GET /tickets returned ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('GET /tickets did not return a list')
        setTickets(data)
        setLastUpdated(new Date())
        setPollFailed(false)
      })
      .catch(() => setPollFailed(true))
  }

  // Poll every 5 seconds while logged in. Depends only on being logged in, not on the token itself,
  // so a refresh in the background does not restart the timer.
  const loggedIn = auth !== null
  useEffect(() => {
    if (!loggedIn) return
    fetchTickets()
    const interval = setInterval(fetchTickets, 5000)
    return () => clearInterval(interval)
  }, [loggedIn])

  /** Called by LoginPage with the /login response; saveAuth stores it and updates the screen. */
  const handleLogin = (user: AuthUser) => saveAuth(user)

  /**
   * Revokes the refresh token on the server (PUT /logout), then clears the local session.
   * finally() clears it even if the server cannot be reached, so Sign out always signs out locally.
   */
  const handleLogout = () => {
    apiFetch('/logout', { method: 'PUT' })
      .finally(() => saveAuth(null))
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

        {/* Stale-data warning: on a monitoring dashboard, old numbers shown as current are the worst failure */}
        {pollFailed && (
          <p className="bg-alert-tint text-alert text-xs rounded px-3 py-2 mb-6" role="alert">
            {lastUpdated
              // No period after the time: some locales already end it with one ("9:39:41 p.m.").
              ? `Ticket updates are failing, retrying every 5 seconds. Last good data: ${lastUpdated.toLocaleTimeString()}`
              : 'Tickets could not be loaded. Retrying every 5 seconds.'}
          </p>
        )}

        {auth.role === 'developer' && auth.team && (
          <p className="text-dim text-xs -mt-4 mb-6">
            <span className="text-faint">Team:</span> {auth.team}
          </p>
        )}

        {/* Team management — managers only */}
        {auth.role === 'manager' && (
          <div className="mb-8">
            <TeamPanel />
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
                role={auth.role}
                onResolve={fetchTickets}
                onAssigned={fetchTickets}
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
