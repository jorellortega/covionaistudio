"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react"
import { getSupabaseClient } from './supabase'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { sessionSync } from './session-sync'

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
  hasSubscription: () => boolean
  hasRole: (role: 'user' | 'creator' | 'studio' | 'production' | 'ceo') => boolean
  updateApiKey: (apiKey: string) => Promise<void>
  updateServiceApiKey: (service: string, apiKey: string) => Promise<void>
  refreshUser: () => Promise<void>
  resetAuthState: () => void
  forceRefresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Global singleton state that persists across route changes
class AuthStateManager {
  private static instance: AuthStateManager
  private user: User | null = null
  private loading: boolean = true
  private loadingStep: string = 'Initializing...'
  private isInitialized: boolean = false
  private isInitializing: boolean = false
  private authSubscription: any = null
  private crossTabListener: (() => void) | null = null
  private sessionPromise: Promise<void> | null = null

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager()
    }
    return AuthStateManager.instance
  }

  getUser(): User | null {
    return this.user
  }

  setUser(user: User | null) {
    this.user = user
  }

  getLoading(): boolean {
    return this.loading
  }

  setLoading(loading: boolean) {
    this.loading = loading
  }

  getLoadingStep(): string {
    return this.loadingStep
  }

  setLoadingStep(step: string) {
    this.loadingStep = step
  }

  isAuthInitialized(): boolean {
    return this.isInitialized
  }

  setInitialized(initialized: boolean) {
    this.isInitialized = initialized
  }

  isCurrentlyInitializing(): boolean {
    return this.isInitializing
  }

  setCurrentlyInitializing(initializing: boolean) {
    this.isInitializing = initializing
  }

  getAuthSubscription(): any {
    return this.authSubscription
  }

  setAuthSubscription(subscription: any) {
    this.authSubscription = subscription
  }

  getCrossTabListener(): (() => void) | null {
    return this.crossTabListener
  }

  setCrossTabListener(listener: (() => void) | null) {
    this.crossTabListener = listener
  }

  getSessionPromise(): Promise<void> | null {
    return this.sessionPromise
  }

  setSessionPromise(promise: Promise<void> | null) {
    this.sessionPromise = promise
  }

  cleanup() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
      this.authSubscription = null
    }
    if (this.crossTabListener) {
      sessionSync.removeListener(this.crossTabListener)
      this.crossTabListener = null
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stateManager = AuthStateManager.getInstance()
  
  // Initialize state from singleton
  const [user, setUser] = useState<User | null>(stateManager.getUser())
  const [loading, setLoading] = useState(stateManager.getLoading())
  const [loadingStep, setLoadingStep] = useState<string>(stateManager.getLoadingStep())
  
  // Use refs to prevent race conditions
  const mounted = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingAuthChange = useRef(false)

  // Update both local and global state
  const updateState = useCallback((newUser: User | null, newLoading: boolean, newStep: string) => {
    setUser(newUser)
    setLoading(newLoading)
    setLoadingStep(newStep)
    
    // Update global state
    stateManager.setUser(newUser)
    stateManager.setLoading(newLoading)
    stateManager.setLoadingStep(newStep)
  }, [stateManager])

  // Cleanup function
  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  // Set loading timeout with cleanup
  const setLoadingTimeout = useCallback(() => {
    clearLoadingTimeout()
    loadingTimeoutRef.current = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn('Loading timeout reached, forcing loading to false')
        updateState(user, false, 'Timeout reached')
      }
    }, 15000)
  }, [loading, user, updateState, clearLoadingTimeout])

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
        // Sync role from subscription if user doesn't have CEO role
        if (data.role !== 'ceo') {
          try {
            // Check for active subscription
            const { data: subscription, error: subError } = await supabase
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
                await supabase
                  .from('users')
                  .update({ role: subscriptionRole })
                  .eq('id', userId)
                
                // Update data.role for return value
                data.role = subscriptionRole
              }
            } else if (data.role !== 'user') {
              // No active subscription, revert to 'user' if not already
              console.log(`No active subscription, reverting role to 'user'`)
              await supabase
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
      const { data: { user: authUser } } = await getSupabaseClient().auth.getUser()
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

  // Handle session changes with debouncing
  const handleSessionChange = useCallback(async (session: Session | null) => {
    // Prevent multiple simultaneous calls
    if (isProcessingAuthChange.current) {
      console.log('🔄 handleSessionChange already in progress, skipping...')
      return
    }

    isProcessingAuthChange.current = true
    console.log('🔄 handleSessionChange called with session:', session ? 'exists' : 'null')
    
    try {
      if (session?.user) {
        console.log('Session found, fetching user profile...')
        updateState(user, true, 'Fetching user profile...')
        
        let userProfile = await fetchUserProfile(session.user.id)
        
        if (!userProfile) {
          console.log('Profile not found, creating...')
          updateState(user, true, 'Creating user profile...')
          userProfile = await createUserProfile(session.user.id)
        }
        
        if (userProfile) {
          console.log('✅ User profile set successfully')
          updateState(userProfile, false, 'Complete')
          // Broadcast auth change to other tabs
          sessionSync.broadcastAuthChange()
        } else {
          console.error('❌ Failed to fetch/create user profile')
          updateState(null, false, 'Failed to get user profile')
        }
      } else {
        console.log('No session, clearing user')
        updateState(null, false, 'No session found')
        // Broadcast auth change to other tabs
        sessionSync.broadcastAuthChange()
      }
    } catch (error) {
      console.error('❌ Error in handleSessionChange:', error)
      updateState(null, false, 'Error occurred')
    } finally {
      console.log('🔄 handleSessionChange completed, setting loading to false')
      clearLoadingTimeout()
      isProcessingAuthChange.current = false
    }
  }, [fetchUserProfile, clearLoadingTimeout, user, updateState])

  // Initialize auth state only once
  useEffect(() => {
    console.log('[AuthProvider] mount');
    
    // If already initialized globally, just restore the state
    if (stateManager.isAuthInitialized() && stateManager.getUser()) {
      console.log('🔄 Restoring global auth state')
      updateState(stateManager.getUser(), false, 'Complete')
      return
    }

    // If already initializing, wait for it to complete
    if (stateManager.isCurrentlyInitializing() && stateManager.getSessionPromise()) {
      console.log('🔄 Waiting for existing initialization to complete...')
      stateManager.getSessionPromise()!.then(() => {
        if (mounted.current) {
          updateState(stateManager.getUser(), false, 'Complete')
        }
      }).catch(() => {
        if (mounted.current) {
          updateState(null, false, 'Initialization failed')
        }
      })
      return
    }

    const initializeAuth = async () => {
      if (stateManager.isCurrentlyInitializing()) {
        console.log('⚠️ Auth initialization already in progress')
        return
      }

      stateManager.setCurrentlyInitializing(true)
      
      try {
        console.log('🚀 Initializing auth...')
        updateState(user, true, 'Initializing authentication...')
        setLoadingTimeout()
        
        // Get initial session
        console.log('📡 Fetching initial session...')
        updateState(user, true, 'Fetching initial session...')
        const { data: { session } } = await getSupabaseClient().auth.getSession()
        console.log('📡 Initial session result:', session ? 'found' : 'none')
        
        if (mounted.current) {
          console.log('🔄 Calling handleSessionChange...')
          updateState(user, true, 'Processing session...')
          await handleSessionChange(session)
          stateManager.setInitialized(true)
        } else {
          console.log('⚠️ Component unmounted during initialization')
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error)
        if (mounted.current) {
          updateState(null, false, 'Error occurred')
          clearLoadingTimeout()
        }
      } finally {
        stateManager.setCurrentlyInitializing(false)
      }
    }

    // Create a promise for the initialization and store it
    const initPromise = initializeAuth()
    stateManager.setSessionPromise(initPromise)

    // Listen for auth changes with debouncing
          const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        console.log('🔄 Auth state changed:', event, session?.user?.id)
        
        if (!mounted.current) {
          console.log('⚠️ Component unmounted during auth state change')
          return
        }

        // Skip INITIAL_SESSION events to prevent circular initialization
        if (event === 'INITIAL_SESSION') {
          console.log('📡 Skipping INITIAL_SESSION event to prevent circular initialization')
          return
        }

        // Debounce rapid auth changes
        if (isProcessingAuthChange.current) {
          console.log('⚠️ Skipping auth change, already processing...')
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔐 User signed in or token refreshed, setting loading to true')
          updateState(user, true, 'User signed in, processing...')
          setLoadingTimeout()
          
          try {
            console.log('🔄 Calling handleSessionChange from auth state change...')
            await handleSessionChange(session)
          } catch (error) {
            console.error('❌ Error in auth state change handler:', error)
            // Ensure loading is false even on error
            updateState(null, false, 'Error in sign in process')
            clearLoadingTimeout()
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out, clearing state')
          updateState(null, false, 'User signed out')
          clearLoadingTimeout()
          // Broadcast auth change to other tabs
          sessionSync.broadcastAuthChange()
        }
      }
    )

    // Store subscription reference for cleanup
    stateManager.setAuthSubscription(subscription)

    // Listen for cross-tab auth changes
    const handleCrossTabChange = () => {
      if (!mounted.current) return
      
      console.log('Cross-tab auth change detected, refreshing session...')
      updateState(user, true, 'Cross-tab sync...')
      setLoadingTimeout()
      
      // Refresh the session to sync with other tabs
              getSupabaseClient().auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (mounted.current) {
          handleSessionChange(session)
        }
      }).catch((error: any) => {
        console.error('Error refreshing session from cross-tab change:', error)
        if (mounted.current) {
          updateState(null, false, 'Cross-tab sync failed')
          clearLoadingTimeout()
        }
      })
    }

    stateManager.setCrossTabListener(handleCrossTabChange)
    sessionSync.addListener(handleCrossTabChange)

    // Add window unload listener for cleanup
    const handleBeforeUnload = () => {
      console.log('🔄 Window unloading, cleaning up auth state')
      stateManager.cleanup()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      console.log('[AuthProvider] unmount');
      mounted.current = false
      clearLoadingTimeout()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [handleSessionChange, setLoadingTimeout, clearLoadingTimeout, user, updateState, stateManager])

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
      updateState(null, false, 'Signed out')
      clearLoadingTimeout()
      
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Broadcast auth change to other tabs
      sessionSync.broadcastAuthChange()
      
      console.log('Sign out successful')
    } catch (error) {
      console.error('Error in signOut:', error)
      // Ensure state is cleared even on error
      updateState(null, false, 'Sign out error')
      clearLoadingTimeout()
      // Broadcast auth change to other tabs even on error
      sessionSync.broadcastAuthChange()
    }
  }

  const refreshUser = async () => {
    if (user?.id) {
      const userProfile = await fetchUserProfile(user.id)
      if (userProfile) {
        updateState(userProfile, loading, loadingStep)
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
      updateState(updatedUser, loading, loadingStep)
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
        'suno': 'sunoApiKey',
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
      updateState(updatedUser, loading, loadingStep)
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

  const resetAuthState = () => {
    updateState(null, true, 'Resetting...');
    setLoadingTimeout();
  };

  const forceRefresh = async () => {
    try {
      updateState(user, true, 'Force refreshing...');
      setLoadingTimeout();
      
      // Force a fresh session check
      const { data: { session } } = await supabase.auth.getSession();
      await handleSessionChange(session);
    } catch (error) {
      console.error('Error in force refresh:', error);
      updateState(null, false, 'Force refresh failed');
      clearLoadingTimeout();
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
      hasSubscription,
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
