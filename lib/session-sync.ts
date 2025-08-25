// Utility for cross-tab session synchronization
export class SessionSync {
  private static instance: SessionSync
  private listeners: Set<(event: StorageEvent) => void> = new Set()

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this))
    }
  }

  static getInstance(): SessionSync {
    if (!SessionSync.instance) {
      SessionSync.instance = new SessionSync()
    }
    return SessionSync.instance
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'cinema-platform-auth' && event.newValue !== event.oldValue) {
      // Notify all listeners about the auth change
      this.listeners.forEach(listener => listener(event))
    }
  }

  addListener(listener: (event: StorageEvent) => void) {
    this.listeners.add(listener)
  }

  removeListener(listener: (event: StorageEvent) => void) {
    this.listeners.delete(listener)
  }

  // Broadcast auth state change to other tabs
  broadcastAuthChange() {
    if (typeof window !== 'undefined') {
      // Trigger storage event for other tabs
      const event = new StorageEvent('storage', {
        key: 'cinema-platform-auth',
        newValue: 'changed',
        oldValue: 'changed',
        url: window.location.href,
        storageArea: localStorage
      })
      window.dispatchEvent(event)
    }
  }

  // Clean up
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange.bind(this))
    }
    this.listeners.clear()
  }
}

export const sessionSync = SessionSync.getInstance()
