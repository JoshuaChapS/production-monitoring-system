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
  const [developers, setDevelopers]   = useState<Developer[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newTeam, setNewTeam]         = useState(TEAMS[0])
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')

  const fetchDevelopers = () => {
    fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
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
    fetch('http://localhost:8080/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username: newUsername, password: newPassword, team: newTeam })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSuccess(`Developer "${newUsername}" created`)
          setNewUsername('')
          setNewPassword('')
          fetchDevelopers()
        }
      })
  }

  const handleChangeTeam = (id: number, team: string) => {
    fetch(`http://localhost:8080/users/${id}/team`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ team })
    }).then(() => fetchDevelopers())
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
      <h2 className="text-lg font-bold text-white mb-6">Team Management</h2>

      {/* Crear developer */}
      <div className="mb-6">
        <h3 className="text-gray-400 text-sm font-semibold uppercase mb-3">Create Developer</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Username"
            className="bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <select
            className="bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newTeam}
            onChange={e => setNewTeam(e.target.value)}
          >
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-semibold"
            onClick={handleCreate}
          >
            Create
          </button>
        </div>
        {error   && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
      </div>

      {/* Lista de developers */}
      <div>
        <h3 className="text-gray-400 text-sm font-semibold uppercase mb-3">
          Developers ({developers.length})
        </h3>
        {developers.length === 0 ? (
          <p className="text-gray-500 text-sm">No developers yet.</p>
        ) : (
          <div className="space-y-2">
            {developers.map(dev => (
              <div key={dev.id} className="flex items-center justify-between bg-gray-700 rounded px-3 py-2">
                <span className="text-white text-sm font-medium">{dev.username}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">{dev.team || 'No team'}</span>
                  <select
                    className="bg-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none"
                    value={dev.team}
                    onChange={e => handleChangeTeam(dev.id, e.target.value)}
                  >
                    <option value="">No team</option>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
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