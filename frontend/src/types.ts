export interface Ticket {
  id: number
  timestamp: string
  priority: string
  error_rate: number
  status: string
  resolution_note: string
  team: string
  resolved_by: string
}

export interface AuthUser {
  token: string
  role: 'manager' | 'developer'
  team: string
  username: string
}