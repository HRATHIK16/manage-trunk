import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, getToken } from '../api'

const USER_KEY = 'trunkline_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || null)

  useEffect(() => {
    function handleUnauthorized() {
      setUsername(null)
      localStorage.removeItem(USER_KEY)
    }
    window.addEventListener('trunkline:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('trunkline:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (u, p) => {
    const res = await api.login(u, p)
    setToken(res.token)
    localStorage.setItem(USER_KEY, res.username)
    setUsername(res.username)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setToken(null)
    localStorage.removeItem(USER_KEY)
    setUsername(null)
  }, [])

  const isAuthenticated = Boolean(username && getToken())

  return (
    <AuthContext.Provider value={{ username, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
