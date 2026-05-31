import { useState, useEffect } from 'react'
import TicketCard from './TicketCard'

interface Ticket {
  id: number
  timestamp: string
  priority: string
  error_rate: number
  status: string
  resolution_note: string
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open')

  const fetchTickets = () => {
  fetch('http://localhost:8080/tickets')
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) setTickets(data)  // solo si es array
    })
}

  useEffect(() => {
    fetchTickets()
    const interval = setInterval(fetchTickets, 5000)
    return () => clearInterval(interval)
  }, [])

  const openTickets = tickets.filter(t => t.status === 'open')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved')
  const visibleTickets = activeTab === 'open' ? openTickets : resolvedTickets

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-3xl font-bold text-white mb-2">
          Production Monitoring Dashboard
        </h1>
        <p className="text-gray-400 mb-8">CIB Technology</p>

        <div className="flex gap-4 mb-8">
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
            <TicketCard key={ticket.id} {...ticket} onResolve={fetchTickets} />
          ))
        )}

      </div>
    </div>
  )
}

export default App