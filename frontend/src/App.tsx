import { useState, useEffect } from 'react'
import TicketCard from './TicketCard'
import LoginPage from './LoginPage'
import type { Ticket, AuthUser } from './types'

function App() {
  const [auth, setAuth]           = useState<AuthUser | null>(null)
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open')

  // Al montar, revisar si hay sesión guardada en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('auth')
    if (saved) setAuth(JSON.parse(saved))
  }, [])

  const fetchTickets = (token: string) => {
    fetch('http://localhost:8080/tickets', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTickets(data)
      })
  }

  useEffect(() => {
    if (!auth) return
    fetchTickets(auth.token)
    const interval = setInterval(() => fetchTickets(auth.token), 5000)
    return () => clearInterval(interval)
  }, [auth])

  const handleLogin = (user: AuthUser) => {
    setAuth(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth')
    setAuth(null)
    setTickets([])
  }

  // Si no hay auth, mostrar login
  if (!auth) return <LoginPage onLogin={handleLogin} />

  const openTickets     = tickets.filter(t => t.status === 'open')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved')
  const visibleTickets  = activeTab === 'open' ? openTickets : resolvedTickets

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Production Monitoring Dashboard
            </h1>
            <p className="text-gray-400">CIB Technology</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">{auth.username}</p>
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              auth.role === 'manager' ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-300'
            }`}>
              {auth.role.toUpperCase()}
            </span>
            <button
              onClick={handleLogout}
              className="ml-3 text-gray-500 hover:text-red-400 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mostrar equipo si es developer */}
        {auth.role === 'developer' && auth.team && (
          <p className="text-blue-400 text-sm mb-6">Team: {auth.team}</p>
        )}

        {/* Counters */}
        <div className="flex gap-4 mb-8 mt-6">
          <div className="bg-red-900 rounded-lg p-4 flex-1 text-center">
            <p className="text-3xl font-bold text-red-300">{openTickets.length}</p>
            <p className="text-red-400">Active Incidents</p>
          </div>
          <div className="bg-green-900 rounded-lg p-4 flex-1 text-center">
            <p className="text-3xl font-bold text-green-300">{resolvedTickets.length}</p>
            <p className="text-green-400">Resolved Today</p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-6 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'open'
                ? 'border-red-400 text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Active Incidents ({openTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-6 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'resolved'
                ? 'border-green-400 text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Resolved ({resolvedTickets.length})
          </button>
        </div>

        {/* Tickets */}
        {visibleTickets.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No tickets here.</p>
        ) : (
          visibleTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              {...ticket}
              token={auth.token}
              onResolve={() => fetchTickets(auth.token)}
            />
          ))
        )}

      </div>
    </div>
  )
}

export default App