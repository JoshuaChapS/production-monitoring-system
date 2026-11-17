import { useState, useEffect } from 'react'
import { apiFetch } from './api'

interface Developer {
  id: number
  username: string
  role: string
  team: string
}

const TEAMS = ['Backend', 'Frontend', 'Infrastructure', 'Database']

function TeamPanel() {
  const [developers, setDevelopers]     = useState<Developer[]>([])
  const [newUsername, setNewUsername]   = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [newTeam, setNewTeam]           = useState(TEAMS[0])
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  /** Loads the developer list (GET /users, managers only). Keeps the old list if the server did not send one. */
  const fetchDevelopers = () => {
    apiFetch('/users')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setDevelopers(data) })
  }

  useEffect(() => { fetchDevelopers() }, [])

  /**
   * Creates a developer account (POST /users). Shows the server's error message on failure,
   * or a generic one if the server or network failed without sending one.
   */
  const handleCreate = () => {
    setError('')
    setSuccess('')
    if (!newUsername || !newPassword) {
      setError('Username and password are required')
      return
    }
    apiFetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, password: newPassword, team: newTeam }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSuccess(`Developer "${newUsername}" added`)
          setNewUsername('')
          setNewPassword('')
          fetchDevelopers()
        }
      })
      .catch(() => setError('Could not reach the server'))
  }

  /**
   * Moves a developer to another team (PUT /users/:id/team), then reloads the list.
   * Reloading on failure too puts the dropdown back to the real team instead of the one the user picked.
   */
  const handleChangeTeam = (id: number, team: string) => {
    setError('')
    apiFetch(`/users/${id}/team`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team }),
    })
      .then(res => { if (!res.ok) setError('Could not change the team') })
      .catch(() => setError('Could not reach the server'))
      .finally(fetchDevelopers)
  }

  const inputClass =
    'bg-field text-ink rounded border border-rim px-3 py-1.5 text-xs ' +
    'focus:outline-none focus:border-azure transition-colors placeholder:text-faint'

  return (
    <div className="bg-panel rounded p-5">
      <h2 className="text-xs font-semibold text-ink mb-5">Team management</h2>

      {/* Add developer */}
      <div className="mb-5">
        <p className="text-faint text-xs mb-2">Add developer</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Username"
            className={`${inputClass} flex-1 min-w-28`}
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className={`${inputClass} flex-1 min-w-28`}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <select
            className={inputClass}
            value={newTeam}
            onChange={e => setNewTeam(e.target.value)}
          >
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            className="bg-azure-deep text-ink px-3 py-1.5 rounded text-xs font-medium
              hover:opacity-90 transition-opacity"
            onClick={handleCreate}
          >
            Add
          </button>
        </div>
        {error   && <p className="text-alert text-xs mt-2">{error}</p>}
        {success && <p className="text-ok text-xs mt-2">{success}</p>}
      </div>

      {/* Developer list */}
      <div>
        <p className="text-faint text-xs mb-2">
          Developers{developers.length > 0 ? ` (${developers.length})` : ''}
        </p>
        {developers.length === 0 ? (
          <p className="text-faint text-xs">No developers yet.</p>
        ) : (
          <div className="space-y-1">
            {developers.map(dev => (
              <div
                key={dev.id}
                className="flex items-center justify-between bg-field rounded px-3 py-2"
              >
                <span className="text-ink text-xs">{dev.username}</span>
                <select
                  className="bg-transparent text-dim text-xs focus:outline-none
                    cursor-pointer hover:text-ink transition-colors"
                  value={dev.team || ''}
                  onChange={e => handleChangeTeam(dev.id, e.target.value)}
                >
                  <option value="">No team</option>
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamPanel
export { TEAMS }
