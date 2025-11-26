"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { getSupabaseClient } from './supabase'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'creator' | 'studio' | 'production' | 'ceo'
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
  hasSubscription: () => boolean
  hasRole: (role: 'user' | 'creator' | 'studio' | 'production' | 'ceo') => boolean
  updateApiKey: (apiKey: string) => Promise<void>
  updateServiceApiKey: (service: string, apiKey: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Memoized function to fetch user profile
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      console.log('Fetching profile for user:', userId)
      
      const { data, error } = await getSupabaseClient()
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
        
        // Sync role from subscription if user doesn't have CEO role
        if (data.role !== 'ceo') {
          try {
            // Check for active subscription
            const { data: subscription, error: subError } = await getSupabaseClient()
              .from('subscriptions')
              .select('plan_id')
              .eq('user_id', userId)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            
            if (subError && subError.code !== 'PGRST116') {
              console.error('Error checking subscription:', subError)
            } else if (subscription) {
              // Map plan_id to role
              const roleMap: Record<string, 'creator' | 'studio' | 'production'> = {
                'creator': 'creator',
                'studio': 'studio',
                'production': 'production',
              }
              
              const subscriptionRole = roleMap[subscription.plan_id]
              if (subscriptionRole && data.role !== subscriptionRole) {
                console.log(`Syncing role from subscription: ${data.role} -> ${subscriptionRole}`)
                // Update role in database
                await getSupabaseClient()
                  .from('users')
                  .update({ role: subscriptionRole })
                  .eq('id', userId)
                
                // Update data.role for return value
                data.role = subscriptionRole
              }
            } else if (data.role !== 'user') {
              // No active subscription, revert to 'user' if not already
              console.log(`No active subscription, reverting role to 'user'`)
              await getSupabaseClient()
                .from('users')
                .update({ role: 'user' })
                .eq('id', userId)
              
              data.role = 'user'
            }
          } catch (error) {
            console.error('Error syncing role from subscription:', error)
            // Continue with existing role if sync fails
          }
        }
        
        const userData: User = {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role as 'user' | 'creator' | 'studio' | 'production' | 'ceo',
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
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      return null
    }
  }, [])

  const createUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log('Creating profile for user:', userId)
      
      // Get user info from auth
      const { data: { user: authUser } } = await getSupabaseClient().auth.getUser()
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

  // Handle session changes
  const handleSessionChange = useCallback(async (session: Session | null) => {
    try {
      if (session?.user) {
        console.log('Session found, fetching user profile...')
        const userProfile = await fetchUserProfile(session.user.id)
        if (userProfile) {
          setUser(userProfile)
        } else {
          console.error('Failed to fetch user profile, signing out')
          await getSupabaseClient().auth.signOut()
          setUser(null)
        }
      } else {
        console.log('No session, clearing user')
        setUser(null)
      }
    } catch (error) {
      console.error('Error handling session change:', error)
      setUser(null)
    } finally {
      if (!isInitialized) {
        setIsInitialized(true)
        setIsLoading(false)
      }
    }
  }, [fetchUserProfile, isInitialized])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await getSupabaseClient().auth.getSession()
        
        if (mounted) {
          await handleSessionChange(session)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id)
        
        if (mounted) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await handleSessionChange(session)
          } else if (event === 'SIGNED_OUT') {
            setUser(null)
            setIsLoading(false)
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [handleSessionChange])



  const signIn = async (email: string, password: string): Promise<{ error: any }> => {
    try {
      console.log('Attempting to sign in with email:', email)
      setIsLoading(true)
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
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
      const { error } = await getSupabaseClient().auth.signUp({
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
      setIsLoading(true)
      await getSupabaseClient().auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
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
      // Map service names to database column names
      const serviceMapping: { [key: string]: string } = {
        'anthropic': 'anthropic_api_key',
        'openart': 'openart_api_key',
        'kling': 'kling_api_key',
        'runway': 'runway_api_key',
        'elevenlabs': 'elevenlabs_api_key',
        'suno': 'suno_api_key'
      }
      
      // Map service names to user object property names
      const propertyMapping: { [key: string]: string } = {
        'anthropic': 'anthropicApiKey',
        'openart': 'openartApiKey',
        'kling': 'klingApiKey',
        'runway': 'runwayApiKey',
        'elevenlabs': 'elevenlabsApiKey',
        'suno': 'sunoApiKey'
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
    // Backward compatibility: check for any paid subscription
    return user?.role === 'creator' || user?.role === 'studio' || user?.role === 'production' || user?.role === 'ceo';
  };

  const hasSubscription = () => {
    return user?.role === 'creator' || user?.role === 'studio' || user?.role === 'production' || user?.role === 'ceo';
  };

  const hasRole = (role: 'user' | 'creator' | 'studio' | 'production' | 'ceo') => {
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
      hasSubscription,
      hasRole,
      updateApiKey,
      updateServiceApiKey,
      refreshUser,
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
