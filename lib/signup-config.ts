/** Set to true to block all public email/password sign up. */
export const SIGNUP_DISABLED = false

/** Paid plans that can be purchased via Stripe. Others stay listed as coming soon. */
export const PURCHASABLE_SUBSCRIPTION_PLANS = ['creator'] as const

export function isSubscriptionPlanPurchasable(planId: string): boolean {
  return (PURCHASABLE_SUBSCRIPTION_PLANS as readonly string[]).includes(planId)
}

export function subscriptionPlanUnavailableMessage(planId: string): string {
  if (planId === 'studio' || planId === 'production') {
    return 'Studio and Production House plans are not available yet. You can subscribe to Creator now.'
  }
  return 'This plan is not available yet.'
}
