"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react"
import { supabase } from './supabase'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'

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
  leonardoApiKey?: string
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
  refreshUser: () => Promise<void>
  resetLoadingState: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Simplified timeout for operations (60 seconds)
const OPERATION_TIMEOUT = 60000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const initializationRef = useRef(false)
  const profileFetchRef = useRef<Promise<User | null> | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to add timeout to async operations
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ])
  }

  // Debounced user state update to prevent rapid changes
  const setUserDebounced = useCallback((newUser: User | null) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      setUser(newUser)
    }, 100) // 100ms debounce
  }, [])

  // Memoized function to fetch user profile with deduplication
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    // If we're already fetching a profile, return the existing promise
    if (profileFetchRef.current) {
      console.log('Profile fetch already in progress, returning existing promise')
      return profileFetchRef.current
    }

    try {
      console.log('Fetching profile for user:', userId)
      
      const profilePromise = (async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching user profile:', error)
          
          // Handle different error cases
          if (error.code === 'PGRST116') {
            // Profile not found - create it
            console.log('Profile not found, attempting to create...')
            return await createUserProfile(userId)
          } else if (error.code === 'PGRST200') {
            // Multiple rows found - this shouldn't happen
            console.error('Multiple profiles found for user:', userId)
            return null
          } else {
            // Other errors - log and return null
            console.error('Unexpected error fetching profile:', error)
            return null
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
            leonardoApiKey: data.leonardo_api_key,
            created_at: data.created_at,
          }
          return userData
        }

        return null
      })()

      // Store the promise reference
      profileFetchRef.current = profilePromise
      
      // Wait for the result
      const result = await profilePromise
      
      // Clear the reference
      profileFetchRef.current = null
      
      return result
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      // Clear the reference on error
      profileFetchRef.current = null
      return null
    }
  }, [])

  const createUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log('Creating profile for user:', userId)
      
      // Get user info from auth
      const { data: { user: authUser } } = await withTimeout(
        supabase.auth.getUser(),
        OPERATION_TIMEOUT
      )
      if (!authUser) return null
      
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!,
          role: 'user', // Default role for new users
          created_at: new Date().toISOString(),
        })

      if (error) {
        console.error('Error creating user profile:', error)
        
        // If it's a conflict (profile already exists), just fetch it
        if (error.code === '23505') {
          console.log('Profile already exists (conflict), fetching instead...')
          // Add a small delay to prevent rapid retries
          await new Promise(resolve => setTimeout(resolve, 1000))
          return await fetchUserProfile(userId)
        }
        return null
      }

      console.log('Profile created successfully')
      // Fetch the profile again
      return await fetchUserProfile(userId)
    } catch (error) {
      console.error('Error creating user profile:', error)
      return null
    }
  }

  // Simplified session change handler
  const handleSessionChange = useCallback(async (session: Session | null) => {
    try {
      if (session?.user) {
        console.log('Session found, fetching user profile...')
        
        const userProfile = await fetchUserProfile(session.user.id)
        
        if (userProfile) {
          setUserDebounced(userProfile)
        } else {
          console.error('Failed to fetch user profile, signing out')
          await supabase.auth.signOut()
          setUserDebounced(null)
        }
      } else {
        console.log('No session, clearing user')
        setUserDebounced(null)
      }
    } catch (error) {
      console.error('Error handling session change:', error)
      // Don't sign out on timeout, just clear user and continue
      setUserDebounced(null)
    } finally {
      // Always ensure loading is false and initialized is true
      setLoading(false)
      setIsInitialized(true)
    }
  }, [fetchUserProfile, setUserDebounced])

  // Initialize auth state - only run once on mount
  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      console.log('Auth already initialized, skipping...')
      return
    }
    
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...')
        initializationRef.current = true
        setLoading(true)
        
        // Get initial session
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          OPERATION_TIMEOUT
        )
        
        if (mounted) {
          console.log('Initial session:', session ? 'found' : 'none')
          await handleSessionChange(session)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setLoading(true)
            await handleSessionChange(session)
          } else if (event === 'SIGNED_OUT') {
            console.log('User signed out, clearing state')
            setUserDebounced(null)
            setLoading(false)
            
            // Redirect to homepage when signed out
            if (typeof window !== 'undefined') {
              window.location.href = '/'
            }
          }
        }
      }
    )

    return () => {
      mounted = false
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      subscription.unsubscribe()
    }
  }, []) // Empty dependency array - only run once on mount

  const signIn = async (email: string, password: string): Promise<{ error: any }> => {
    try {
      console.log('Attempting to sign in with email:', email)
      
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        OPERATION_TIMEOUT
      )
      
      if (error) {
        console.error('Sign in error:', error)
        
        // Handle specific error cases
        if (error.message?.includes('Invalid login credentials')) {
          return { error: { message: 'Invalid email or password. Please check your credentials and try again.' } }
        } else if (error.message?.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and confirm your account before signing in.' } }
        } else if (error.message?.includes('Too many requests')) {
          return { error: { message: 'Too many sign-in attempts. Please wait a moment and try again.' } }
        } else if (error.message?.includes('Network')) {
          return { error: { message: 'Network error. Please check your connection and try again.' } }
        }
        
        return { error }
      }
      
      console.log('Sign in successful, user:', data.user?.id)
      
      // The session change will be handled by the auth state listener
      return { error: null }
    } catch (error) {
      console.error('Sign in exception:', error)
      
      // Handle timeout and other exceptions
      if (error instanceof Error && error.message.includes('timed out')) {
        return { error: { message: 'Sign-in is taking too long. Please check your connection and try again.' } }
      }
      
      return { error: { message: 'An unexpected error occurred. Please try again.' } }
    }
  }

  const signup = async (email: string, password: string, name: string): Promise<{ error: any }> => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        }),
        OPERATION_TIMEOUT
      )
      if (error) {
        return { error }
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const logout = async () => {
    try {
      console.log('Starting sign out process...')
      
      // Clear user state immediately for better UX
      setUserDebounced(null)
      setLoading(false)
      
      // Sign out from Supabase
      const { error } = await withTimeout(supabase.auth.signOut(), OPERATION_TIMEOUT)
      
      if (error) {
        console.error('Supabase sign out error:', error)
        // Even if Supabase fails, we've already cleared local state
      } else {
        console.log('Sign out successful')
      }
      
      // Clear any remaining auth state
      setIsInitialized(false)
      initializationRef.current = false
      
      // Redirect to homepage
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
      
    } catch (error) {
      console.error('Error in logout function:', error)
      // Ensure state is cleared even on error
      setUserDebounced(null)
      setLoading(false)
      setIsInitialized(false)
      initializationRef.current = false
      
      // Redirect to homepage even on error
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }
  }

  const refreshUser = async () => {
    if (user?.id) {
      const userProfile = await fetchUserProfile(user.id)
      if (userProfile) {
        setUserDebounced(userProfile)
      }
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

      const updatedUser = { ...user, openaiApiKey: apiKey }
      setUserDebounced(updatedUser)
    } catch (error) {
      console.error('Error updating API key:', error)
      throw error
    }
  }

  const updateServiceApiKey = async (service: string, apiKey: string) => {
    if (!user) return
    
    try {
      // Map service names to database column names
      const serviceMapping: { [key: string]: string } = {
        'anthropic': 'anthropic_api_key',
        'openart': 'openart_api_key',
        'kling': 'kling_api_key',
        'runway': 'runway_api_key',
        'elevenlabs': 'elevenlabs_api_key',
        'suno': 'suno_api_key',
        'leonardo': 'leonardo_api_key'
      }
      
      // Map service names to user object property names
      const propertyMapping: { [key: string]: string } = {
        'anthropic': 'anthropicApiKey',
        'openart': 'openartApiKey',
        'kling': 'klingApiKey',
        'runway': 'runwayApiKey',
        'elevenlabs': 'elevenlabsApiKey',
        'suno': 'sunoApiKey',
        'leonardo': 'leonardoApiKey'
      }
      
      const dbColumn = serviceMapping[service]
      const userProperty = propertyMapping[service]
      
      if (!dbColumn || !userProperty) {
        throw new Error(`Unsupported service: ${service}`)
      }
      
      const updateData: any = {}
      updateData[dbColumn] = apiKey

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      if (error) {
        throw error
      }

      const updatedUser = { ...user, [userProperty]: apiKey }
      setUserDebounced(updatedUser)
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

  const resetLoadingState = () => {
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn: signIn,
      signUp: signup,
      signOut: logout,
      isCeo,
      hasCinemaSubscription,
      hasRole,
      updateApiKey,
      updateServiceApiKey,
      refreshUser,
      resetLoadingState,
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
