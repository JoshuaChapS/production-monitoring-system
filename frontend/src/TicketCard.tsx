import { useState, useEffect } from 'react'
import type { Ticket } from './types'
import { TEAMS } from './TeamPanel'
import { apiFetch } from './api'

interface TicketCardProps extends Ticket {
  role: string
  onResolve: () => void
  onAssigned: () => void
}

function TicketCard({
  id, timestamp, priority, error_rate, status,
  resolution_note, team, resolved_by,
  role, onResolve, onAssigned,
}: TicketCardProps) {
  const [showResolve, setShowResolve] = useState(false)
  const [showAssign, setShowAssign]   = useState(false)
  const [note, setNote]               = useState('')
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0])
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowResolve(false); setShowAssign(false); setActionError('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Sends a PUT with a JSON body through apiFetch and reports whether the server accepted it.
   * Returns true only for a 2xx status; a 401, 403, 404, 500 or a network failure all return false,
   * so a failed action can never look like a successful one.
   */
  const sendUpdate = (path: string, body: object): Promise<boolean> =>
    apiFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(res => res.ok)
      .catch(() => false)

  /** Resolves the ticket with the typed note. Closes the modal only if the server confirmed it. */
  const handleResolve = () => {
    sendUpdate(`/tickets/${id}`, { resolution_note: note }).then(ok => {
      if (!ok) {
        setActionError('Could not resolve the ticket. Try again.')
        return
      }
      setActionError('')
      setShowResolve(false)
      setNote('')
      onResolve()
    })
  }

  /** Assigns the ticket to the selected team. Closes the modal only if the server confirmed it. */
  const handleAssign = () => {
    sendUpdate(`/tickets/${id}/assign`, { team: selectedTeam }).then(ok => {
      if (!ok) {
        setActionError('Could not assign the ticket. Try again.')
        return
      }
      setActionError('')
      setShowAssign(false)
      onAssigned()
    })
  }

  const isResolved = status === 'resolved'

  const fieldClass =
    'w-full bg-field text-ink rounded border border-rim px-3 py-2 text-sm ' +
    'focus:outline-none focus:border-azure transition-colors placeholder:text-faint'

  return (
    <div className={`bg-panel rounded px-4 py-3 ${isResolved ? 'opacity-60' : ''}`}>

      {/* Top row: ID, priority, team, timestamp */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold text-ink shrink-0">
            INC-{String(id).padStart(3, '0')}
          </span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-sm shrink-0 ${
            priority === 'P1'
              ? 'bg-alert-tint text-alert'
              : 'bg-caution-tint text-caution'
          }`}>
            {priority}
          </span>
          {team && (
            <span className="text-faint text-xs truncate">{team}</span>
          )}
        </div>
        <span className="font-mono text-xs text-faint shrink-0 mt-px">
          {timestamp}
        </span>
      </div>

      {/* Data row */}
      <div className="flex items-center gap-4 mt-1.5">
        <span className="font-mono text-xs text-dim">
          {error_rate.toFixed(2)}% errors
        </span>
        <span className={`text-xs ${isResolved ? 'text-ok' : 'text-faint'}`}>
          {status}
        </span>
      </div>

      {/* Resolution info */}
      {isResolved && (resolved_by || resolution_note) && (
        <p className="text-faint text-xs mt-1.5 leading-relaxed">
          {resolved_by && <span>Resolved by {resolved_by}</span>}
          {resolution_note && (
            <span className="italic"> — {resolution_note}</span>
          )}
        </p>
      )}

      {/* Actions */}
      {!isResolved && (
        <div className="flex gap-2 mt-3">
          <button
            className="text-xs font-medium px-3 py-1.5 rounded bg-ok-tint text-ok
              hover:opacity-80 transition-opacity"
            onClick={() => setShowResolve(true)}
          >
            Resolve
          </button>
          {role === 'manager' && (
            <button
              className="text-xs font-medium px-3 py-1.5 rounded bg-field text-dim
                hover:text-ink transition-colors"
              onClick={() => setShowAssign(true)}
            >
              {team ? 'Reassign' : 'Assign'}
            </button>
          )}
        </div>
      )}

      {/* Resolve modal */}
      {showResolve && (
        <div
          className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`Resolve INC-${String(id).padStart(3, '0')}`}
        >
          <div className="bg-panel rounded-md border border-rim p-6 w-full max-w-md mx-4">
            <h3 className="text-ink text-sm font-semibold mb-1">
              Resolve INC-{String(id).padStart(3, '0')}
            </h3>
            <p className="text-dim text-xs mb-4">
              Describe the cause and how it was fixed.
            </p>
            <textarea
              className={`${fieldClass} resize-none`}
              rows={4}
              placeholder="DB connection pool exhausted. Restarted service and increased pool size."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            {actionError && <p className="text-alert text-xs mt-2" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 rounded text-faint hover:text-ink text-xs transition-colors"
                onClick={() => { setShowResolve(false); setNote(''); setActionError('') }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-ok-tint text-ok text-xs font-medium
                  hover:opacity-80 transition-opacity"
                onClick={handleResolve}
              >
                Confirm resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {showAssign && (
        <div
          className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`Assign INC-${String(id).padStart(3, '0')}`}
        >
          <div className="bg-panel rounded-md border border-rim p-6 w-full max-w-sm mx-4">
            <h3 className="text-ink text-sm font-semibold mb-1">
              Assign INC-{String(id).padStart(3, '0')}
            </h3>
            <p className="text-dim text-xs mb-4">
              Select the team responsible for this incident.
            </p>
            <select
              className={`${fieldClass} mb-4`}
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {actionError && <p className="text-alert text-xs -mt-2 mb-4" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded text-faint hover:text-ink text-xs transition-colors"
                onClick={() => { setShowAssign(false); setActionError('') }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-azure-tint text-azure text-xs font-medium
                  hover:opacity-80 transition-opacity"
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
