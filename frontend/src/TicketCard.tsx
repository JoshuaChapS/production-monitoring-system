interface TicketProps {
  id: number
  timestamp: string
  priority: string
  error_rate: number
  status: string
  onResolve: () => void
}

function TicketCard({ id, timestamp, priority, error_rate, status, onResolve }: TicketProps) {
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
      {status === 'open' && (
        <button
          className="mt-3 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
          onClick={() => {
            fetch(`http://localhost:8080/tickets/${id}`, { method: 'PUT' })
              .then(() => onResolve())
          }}
        >
          Resolve
        </button>
      )}
    </div>
  )
}

export default TicketCard