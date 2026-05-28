import { useState, useEffect } from 'react'
import TicketCard from './TicketCard'

interface Ticket {
  id: number
  timestamp: string
  priority: string
  error_rate: number
  status: string
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])

  const fetchTickets = () => {
    fetch('http://localhost:8080/tickets')
      .then(res => res.json())
      .then(data => setTickets(data))
  }

  useEffect(() => {
    fetchTickets()
    const interval = setInterval(fetchTickets, 5000)
    return () => clearInterval(interval)
  }, [])

  const openTickets = tickets.filter(t => t.status === 'open')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved')

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

        <h2 className="text-xl font-semibold text-red-400 mb-4">
          Active Incidents
        </h2>
        {openTickets.map(ticket => (
          <TicketCard key={ticket.id} {...ticket} onResolve={fetchTickets} />
        ))}

        <h2 className="text-xl font-semibold text-green-400 mt-8 mb-4">
          Resolved
        </h2>
        {resolvedTickets.map(ticket => (
          <TicketCard key={ticket.id} {...ticket} onResolve={fetchTickets} />
        ))}

      </div>
    </div>
  )
}

export default App