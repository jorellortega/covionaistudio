"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { supabase } from './supabase'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { sessionSync } from './session-sync'

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
  settings_password_hash?: string
  settings_password_enabled?: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  loadingStep: string
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  isCeo: () => boolean
  hasCinemaSubscription: () => boolean
  hasRole: (role: 'user' | 'cinema' | 'ceo') => boolean
  updateApiKey: (apiKey: string) => Promise<void>
  updateServiceApiKey: (service: string, apiKey: string) => Promise<void>
  refreshUser: () => Promise<void>
  resetAuthState: () => void
  forceRefresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState<string>('Initializing...')

  // Add timeout to prevent loading from getting stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached, forcing loading to false')
        setLoading(false)
        setLoadingStep('Timeout reached')
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  // Simple function to fetch user profile
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      if (data) {
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
          settings_password_hash: data.settings_password_hash,
          settings_password_enabled: data.settings_password_enabled,
          created_at: data.created_at,
        }
        return userData
      }

      return null
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      return null
    }
  }, [])

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null
      
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!,
          role: 'user',
          created_at: new Date().toISOString(),
        })

      if (error) {
        console.error('Error creating user profile:', error)
        return null
      }

      return await fetchUserProfile(userId)
    } catch (error) {
      console.error('Error creating user profile:', error)
      return null
    }
  }

  // Handle session changes
  const handleSessionChange = useCallback(async (session: Session | null) => {
    console.log('🔄 handleSessionChange called with session:', session ? 'exists' : 'null')
    try {
      if (session?.user) {
        console.log('Session found, fetching user profile...')
        setLoadingStep('Fetching user profile...')
        
        let userProfile = await fetchUserProfile(session.user.id)
        
        if (!userProfile) {
          console.log('Profile not found, creating...')
          setLoadingStep('Creating user profile...')
          userProfile = await createUserProfile(session.user.id)
        }
        
        if (userProfile) {
          console.log('✅ User profile set successfully')
          setLoadingStep('Setting user data...')
          setUser(userProfile)
          // Broadcast auth change to other tabs
          sessionSync.broadcastAuthChange()
        } else {
          console.error('❌ Failed to fetch/create user profile')
          setLoadingStep('Failed to get user profile')
          setUser(null)
        }
      } else {
        console.log('No session, clearing user')
        setLoadingStep('No session found')
        setUser(null)
        // Broadcast auth change to other tabs
        sessionSync.broadcastAuthChange()
      }
    } catch (error) {
      console.error('❌ Error in handleSessionChange:', error)
      setLoadingStep('Error occurred')
      setUser(null)
    } finally {
      console.log('🔄 handleSessionChange completed, setting loading to false')
      // Always ensure loading is false
      setLoading(false)
      setLoadingStep('Complete')
    }
  }, [fetchUserProfile])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing auth...')
        setLoading(true)
        setLoadingStep('Initializing authentication...')
        
        // Get initial session
        console.log('📡 Fetching initial session...')
        setLoadingStep('Fetching initial session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('📡 Initial session result:', session ? 'found' : 'none')
        
        if (mounted) {
          console.log('🔄 Calling handleSessionChange...')
          setLoadingStep('Processing session...')
          await handleSessionChange(session)
        } else {
          console.log('⚠️ Component unmounted during initialization')
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
          setUser(null)
          setLoadingStep('Error occurred')
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.id)
        
        if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            console.log('🔐 User signed in or token refreshed, setting loading to true')
            setLoading(true)
            setLoadingStep('User signed in, processing...')
            try {
              console.log('🔄 Calling handleSessionChange from auth state change...')
              await handleSessionChange(session)
            } catch (error) {
              console.error('❌ Error in auth state change handler:', error)
              // Ensure loading is false even on error
              setLoading(false)
              setUser(null)
              setLoadingStep('Error in sign in process')
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('🚪 User signed out, clearing state')
            setLoadingStep('User signed out')
            setUser(null)
            setLoading(false)
            // Broadcast auth change to other tabs
            sessionSync.broadcastAuthChange()
          }
        } else {
          console.log('⚠️ Component unmounted during auth state change')
        }
      }
    )

    // Listen for cross-tab auth changes
    const handleCrossTabChange = () => {
      if (mounted) {
        console.log('Cross-tab auth change detected, refreshing session...')
        setLoading(true)
        // Refresh the session to sync with other tabs
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (mounted) {
            handleSessionChange(session)
          }
        }).catch((error) => {
          console.error('Error refreshing session from cross-tab change:', error)
          if (mounted) {
            setLoading(false)
            setUser(null)
          }
        })
      }
    }

    sessionSync.addListener(handleCrossTabChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      sessionSync.removeListener(handleCrossTabChange)
    }
  }, [handleSessionChange])

  const signIn = async (email: string, password: string): Promise<{ error: any }> => {
    try {
      console.log('Attempting to sign in with email:', email)
      
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
    }
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error: any }> => {
    try {
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
    }
  }

  const signOut = async () => {
    try {
      console.log('Starting sign out process...')
      
      // Clear user state immediately
      setUser(null)
      setLoading(false)
      
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Broadcast auth change to other tabs
      sessionSync.broadcastAuthChange()
      
      console.log('Sign out successful')
    } catch (error) {
      console.error('Error in signOut:', error)
      // Ensure state is cleared even on error
      setUser(null)
      setLoading(false)
      // Broadcast auth change to other tabs even on error
      sessionSync.broadcastAuthChange()
    }
  }

  const refreshUser = async () => {
    if (user?.id) {
      const userProfile = await fetchUserProfile(user.id)
      if (userProfile) {
        setUser(userProfile)
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
      setUser(updatedUser)
    } catch (error) {
      console.error('Error updating API key:', error)
      throw error
    }
  }

  const updateServiceApiKey = async (service: string, apiKey: string) => {
    if (!user) return
    
    try {
      const serviceMapping: { [key: string]: string } = {
        'anthropic': 'anthropic_api_key',
        'openart': 'openart_api_key',
        'kling': 'kling_api_key',
        'runway': 'runway_api_key',
        'elevenlabs': 'elevenlabs_api_key',
        'suno': 'suno_api_key',
        'leonardo': 'leonardo_api_key'
      }
      
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

  const resetAuthState = () => {
    setUser(null);
    setLoading(true);
    setLoadingStep('Resetting...');
  };

  const forceRefresh = async () => {
    try {
      setLoading(true);
      setLoadingStep('Force refreshing...');
      
      // Force a fresh session check
      const { data: { session } } = await supabase.auth.getSession();
      await handleSessionChange(session);
    } catch (error) {
      console.error('Error in force refresh:', error);
      setLoading(false);
      setUser(null);
      setLoadingStep('Force refresh failed');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      loadingStep,
      signIn,
      signUp,
      signOut,
      isCeo,
      hasCinemaSubscription,
      hasRole,
      updateApiKey,
      updateServiceApiKey,
      refreshUser,
      resetAuthState,
      forceRefresh,
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
