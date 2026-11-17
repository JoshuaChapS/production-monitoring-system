import { API_URL } from './config'
import type { AuthUser } from './types'

// localStorage is the single source of truth for tokens; React state only mirrors it through this listener.
type AuthListener = (auth: AuthUser | null) => void
let listener: AuthListener = () => {}

/**
 * Registers the one function to call whenever the stored session changes (refreshed or cleared).
 * App.tsx passes its setAuth here, so a refresh or a forced logout also updates what React renders.
 */
export function onAuthChange(fn: AuthListener) {
  listener = fn
}

/**
 * Reads the current session from localStorage.
 * Returns null when there is no session or the stored value is not valid JSON.
 */
export function loadAuth(): AuthUser | null {
  try {
    const saved = localStorage.getItem('auth')
    return saved ? (JSON.parse(saved) as AuthUser) : null
  } catch {
    return null
  }
}

/**
 * Stores a new session (after login or refresh), or deletes it when given null (logout or failed refresh),
 * then notifies the listener so the UI follows. This is the only function that writes the session.
 */
export function saveAuth(auth: AuthUser | null) {
  if (auth) localStorage.setItem('auth', JSON.stringify(auth))
  else localStorage.removeItem('auth')
  listener(auth)
}

// Refresh tokens are single use, so parallel 401s must share one refresh instead of racing each other.
let refreshing: Promise<boolean> | null = null

/**
 * Trades the stored refresh token for a new access token and a new refresh token (POST /refresh).
 * Saves the new pair on success. Returns true if the session was renewed, false if it could not be.
 */
async function refresh(): Promise<boolean> {
  const auth = loadAuth()
  if (!auth || !auth.refresh) return false
  const res = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: auth.refresh }),
  })
  if (!res.ok) return false
  saveAuth((await res.json()) as AuthUser)
  return true
}

/**
 * Returns the access token stored right now, or undefined when logged out.
 * Read at send time on purpose, so no caller can send a token that a refresh already replaced.
 */
function currentToken(): string | undefined {
  const auth = loadAuth()
  return auth ? auth.token : undefined
}

/**
 * Drop-in replacement for fetch() for every protected endpoint. Takes a path such as '/tickets'.
 * Adds the Authorization header. On a 401 it refreshes the session once and retries the request once;
 * if the refresh fails it clears the session, which sends the user back to the login page.
 * Returns the final Response; callers still check res.ok for other errors.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Builds and sends the request with the given token, keeping any headers the caller passed.
  const send = (token: string | undefined) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_URL}${path}`, { ...init, headers })
  }

  const sentToken = currentToken()
  const res = await send(sentToken)
  if (res.status !== 401) return res

  // If the token changed while this request was in flight, another request already refreshed: just retry.
  if (currentToken() === sentToken) {
    if (refreshing === null) {
      refreshing = refresh()
        .catch(() => false)
        .finally(() => { refreshing = null })
    }
    const ok = await refreshing
    if (!ok) {
      saveAuth(null)
      return res
    }
  }
  // Retry exactly once: a second 401 with a fresh token is not an expiry problem, so do not loop.
  return send(currentToken())
}
