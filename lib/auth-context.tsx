"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { supabase } from './supabase'
import { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'cinema' | 'ceo'
  openaiApiKey?: string
  anthropicApiKey?: string
  openartApiKey?: string
  klingApiKey?: string
  runwayApiKey?: string
  elevenlabsApiKey?: string
  sunoApiKey?: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  isCeo: () => boolean
  hasCinemaSubscription: () => boolean
  hasRole: (role: 'user' | 'cinema' | 'ceo') => boolean
  updateApiKey: (apiKey: string) => Promise<void>
  updateServiceApiKey: (service: string, apiKey: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Add a small delay to ensure the profile is created
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Try to fetch profile with retries
          let retries = 3
          while (retries > 0) {
            try {
              await fetchUserProfile(session.user.id)
              break // Success, exit retry loop
            } catch (error) {
              retries--
              if (retries > 0) {
                console.log(`Profile fetch failed, retrying... (${retries} attempts left)`)
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }
          }
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Error getting initial session:', error)
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        if (session?.user) {
          // Add a small delay for new signups
          if (event === 'SIGNED_IN') {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          await fetchUserProfile(session.user.id)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        
        // Handle different error cases
        if (error.code === 'PGRST116') {
          // Profile not found - this shouldn't happen with our trigger
          console.log('Profile not found, attempting to create...')
          await createUserProfile(userId)
          return
        } else if (error.code === 'PGRST200') {
          // Multiple rows found - this shouldn't happen
          console.error('Multiple profiles found for user:', userId)
          return
        } else {
          // Other errors - log and return
          console.error('Unexpected error fetching profile:', error)
          return
        }
      }

      if (data) {
        console.log('Profile fetched successfully:', data)
        const userData: User = {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role as 'user' | 'cinema' | 'ceo',
          openaiApiKey: data.openai_api_key,
          anthropicApiKey: data.anthropic_api_key,
          openartApiKey: data.openart_api_key,
          klingApiKey: data.kling_api_key,
          runwayApiKey: data.runway_api_key,
          elevenlabsApiKey: data.elevenlabs_api_key,
          sunoApiKey: data.suno_api_key,
          created_at: data.created_at,
        }
        setUser(userData)
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
    }
  }

  const createUserProfile = async (userId: string) => {
    try {
      console.log('Creating profile for user:', userId)
      
      // First, check if profile already exists (double-check)
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()
      
      if (existingProfile) {
        console.log('Profile already exists, fetching instead...')
        await fetchUserProfile(userId)
        return
      }
      
      // Get user info from auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: user.email!,
          name: user.user_metadata?.name || user.email!,
          role: 'user', // Default role for new users
          created_at: new Date().toISOString(),
        })

      if (error) {
        console.error('Error creating user profile:', error)
        
        // If it's a conflict (profile already exists), just fetch it
        if (error.code === '23505') {
          console.log('Profile already exists (conflict), fetching instead...')
          await fetchUserProfile(userId)
          return
        }
        return
      }

      console.log('Profile created successfully')
      // Fetch the profile again
      await fetchUserProfile(userId)
    } catch (error) {
      console.error('Error creating user profile:', error)
    }
  }

  const signIn = async (email: string, password: string): Promise<{ error: any }> => {
    try {
      console.log('Attempting to sign in with email:', email)
      setIsLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Sign in error:', error)
        return { error }
      }
      
      console.log('Sign in successful, user:', data.user?.id)
      return { error: null }
    } catch (error) {
      console.error('Sign in exception:', error)
      return { error }
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string): Promise<{ error: any }> => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })
      if (error) {
        return { error }
      }
      return { error: null }
    } catch (error) {
      return { error }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const updateApiKey = async (apiKey: string) => {
    if (!user) return
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ openai_api_key: apiKey })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      const updatedUser = { ...user, openai_api_key: apiKey }
      setUser(updatedUser)
    } catch (error) {
      console.error('Error updating API key:', error)
      throw error
    }
  }

  const updateServiceApiKey = async (service: string, apiKey: string) => {
    if (!user) return
    
    try {
      const updateData: any = {}
      updateData[`${service}_api_key`] = apiKey

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      if (error) {
        throw error
      }

      const updatedUser = { ...user, [`${service}ApiKey`]: apiKey }
      setUser(updatedUser)
    } catch (error) {
      console.error('Error updating service API key:', error)
      throw error
    }
  }

  const isCeo = () => {
    return user?.role === 'ceo';
  };

  const hasCinemaSubscription = () => {
    return user?.role === 'cinema';
  };

  const hasRole = (role: 'user' | 'cinema' | 'ceo') => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading: isLoading,
      signIn: signIn,
      signUp: signup,
      signOut: logout,
      isCeo,
      hasCinemaSubscription,
      hasRole,
      updateApiKey,
      updateServiceApiKey,
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
