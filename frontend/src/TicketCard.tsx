import { useState } from 'react'
import type { Ticket } from './types'
import { TEAMS } from './TeamPanel'

import { API_URL } from './config'


interface TicketCardProps extends Ticket {
  token: string
  role: string
  onResolve: () => void
  onAssigned: () => void
}

function TicketCard({ id, timestamp, priority, error_rate, status,
                      resolution_note, team, resolved_by,
                      token, role, onResolve, onAssigned }: TicketCardProps) {
  const [showModal, setShowModal]       = useState(false)
  const [showAssign, setShowAssign]     = useState(false)
  const [note, setNote]                 = useState('')
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0])

  const handleResolve = () => {
    fetch(`${API_URL}/tickets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ resolution_note: note })
    }).then(() => {
      setShowModal(false)
      setNote('')
      onResolve()
    })
  }

  const handleAssign = () => {
    fetch(`${API_URL}/tickets/${id}/assign`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ team: selectedTeam })
    }).then(() => {
      setShowAssign(false)
      onAssigned()
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">INC-00{id}</h2>
        <span className={`px-2 py-1 rounded text-sm font-bold ${
          priority === 'P1' ? 'bg-red-600' : 'bg-yellow-600'
        }`}>
          {priority}
        </span>
      </div>

      <p className="text-gray-400 text-sm mt-1">{timestamp}</p>
      <p className="text-white mt-2">Error rate: {error_rate.toFixed(2)}%</p>
      <p className="text-gray-300">Status: {status}</p>

      {team && (
        <p className="text-blue-400 text-sm mt-1">Team: {team}</p>
      )}

      {status === 'resolved' && resolved_by && (
        <p className="text-gray-400 text-sm mt-1">Resolved by: {resolved_by}</p>
      )}

      {status === 'resolved' && resolution_note && (
        <p className="text-gray-400 text-sm mt-1 italic">Note: {resolution_note}</p>
      )}

      {/* Botones — solo en tickets open */}
      {status === 'open' && (
        <div className="flex gap-2 mt-3">
          <button
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm"
            onClick={() => setShowModal(true)}
          >
            Resolve
          </button>

          {/* Assign solo visible para managers */}
          {role === 'manager' && (
            <button
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
              onClick={() => setShowAssign(true)}
            >
              {team ? 'Reassign' : 'Assign'}
            </button>
          )}
        </div>
      )}

      {/* Modal resolver */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-600">
            <h3 className="text-white font-bold text-lg mb-2">Resolve INC-00{id}</h3>
            <p className="text-gray-400 text-sm mb-4">Describe what caused the issue and how it was fixed.</p>
            <textarea
              className="w-full bg-gray-700 text-white rounded p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={4}
              placeholder="e.g. DB connection pool exhausted. Restarted service and increased pool size."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 rounded text-gray-400 hover:text-white"
                onClick={() => { setShowModal(false); setNote('') }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-semibold"
                onClick={handleResolve}
              >
                Confirm Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar equipo */}
      {showAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-600">
            <h3 className="text-white font-bold text-lg mb-2">Assign INC-00{id}</h3>
            <p className="text-gray-400 text-sm mb-4">Select the team responsible for this incident.</p>
            <select
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded text-gray-400 hover:text-white"
                onClick={() => setShowAssign(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                onClick={handleAssign}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TicketCard