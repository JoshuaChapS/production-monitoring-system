import { useState } from 'react'

interface TicketProps {
  id: number
  timestamp: string
  priority: string
  error_rate: number
  status: string
  resolution_note: string
  onResolve: () => void
}

function TicketCard({ id, timestamp, priority, error_rate, status, resolution_note, onResolve }: TicketProps) {
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')

  const handleResolve = () => {
    fetch(`http://localhost:8080/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: note })
    }).then(() => {
      setShowModal(false)
      setNote('')
      onResolve()
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">INC-00{id}</h2>
        <span className={`px-2 py-1 rounded text-sm font-bold ${priority === 'P1' ? 'bg-red-600' : 'bg-yellow-600'}`}>
          {priority}
        </span>
      </div>
      <p className="text-gray-400 text-sm mt-1">{timestamp}</p>
      <p className="text-white mt-2">Error rate: {error_rate.toFixed(2)}%</p>
      <p className="text-gray-300">Status: {status}</p>

      {status === 'resolved' && resolution_note && (
        <p className="text-gray-400 text-sm mt-2 italic">Note: {resolution_note}</p>
      )}

      {status === 'open' && (
        <button
          className="mt-3 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
          onClick={() => setShowModal(true)}
        >
          Resolve
        </button>
      )}

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
    </div>
  )
}

export default TicketCard