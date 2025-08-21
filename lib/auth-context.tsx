"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface User {
  id: string
  email: string
  name: string
  openaiApiKey?: string
  anthropicApiKey?: string
  openartApiKey?: string
  klingApiKey?: string
  runwayApiKey?: string
  elevenlabsApiKey?: string
  sunoApiKey?: string
  createdAt: Date
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  updateApiKey: (apiKey: string) => Promise<void>
  updateServiceApiKey: (service: string, apiKey: string) => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem("cinema-user")
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
      } catch (error) {
        console.error("Error parsing saved user:", error)
        localStorage.removeItem("cinema-user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // In a real app, this would be an API call
      // For now, we'll simulate authentication
      const mockUser: User = {
        id: "1",
        email,
        name: email.split("@")[0],
        createdAt: new Date(),
      }
      
      setUser(mockUser)
      localStorage.setItem("cinema-user", JSON.stringify(mockUser))
    } catch (error) {
      throw new Error("Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true)
    try {
      // In a real app, this would be an API call
      const mockUser: User = {
        id: Date.now().toString(),
        email,
        name,
        createdAt: new Date(),
      }
      
      setUser(mockUser)
      localStorage.setItem("cinema-user", JSON.stringify(mockUser))
    } catch (error) {
      throw new Error("Signup failed")
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("cinema-user")
  }

  const updateApiKey = async (apiKey: string) => {
    if (!user) return
    
    const updatedUser = { ...user, openaiApiKey: apiKey }
    setUser(updatedUser)
    localStorage.setItem("cinema-user", JSON.stringify(updatedUser))
  }

  const updateServiceApiKey = async (service: string, apiKey: string) => {
    if (!user) return
    
    const updatedUser = { ...user, [`${service}ApiKey`]: apiKey }
    setUser(updatedUser)
    localStorage.setItem("cinema-user", JSON.stringify(updatedUser))
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      signup,
      logout,
      updateApiKey,
      updateServiceApiKey,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
