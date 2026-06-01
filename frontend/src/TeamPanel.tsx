import { useState, useEffect } from 'react'
import { API_URL } from './config'

interface Developer {
  id: number
  username: string
  role: string
  team: string
}

interface TeamPanelProps {
  token: string
}

const TEAMS = ['Backend', 'Frontend', 'Infrastructure', 'Database']

function TeamPanel({ token }: TeamPanelProps) {
  const [developers, setDevelopers]     = useState<Developer[]>([])
  const [newUsername, setNewUsername]   = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [newTeam, setNewTeam]           = useState(TEAMS[0])
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  const fetchDevelopers = () => {
    fetch(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setDevelopers(data) })
  }

  useEffect(() => { fetchDevelopers() }, [])

  const handleCreate = () => {
    setError('')
    setSuccess('')
    if (!newUsername || !newPassword) {
      setError('Username and password are required')
      return
    }
    fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
  }

  const handleChangeTeam = (id: number, team: string) => {
    fetch(`${API_URL}/users/${id}/team`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ team }),
    }).then(() => fetchDevelopers())
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
