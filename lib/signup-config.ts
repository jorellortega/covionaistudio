/** Set to true to block all public email/password sign up. */
export const SIGNUP_DISABLED = false

/** Paid plans that can be purchased via Stripe. Others stay listed as coming soon. */
export const PURCHASABLE_SUBSCRIPTION_PLANS = ['creator', 'studio'] as const

export function isSubscriptionPlanPurchasable(planId: string): boolean {
  return (PURCHASABLE_SUBSCRIPTION_PLANS as readonly string[]).includes(planId)
}

export function subscriptionPlanUnavailableMessage(planId: string): string {
  if (planId === 'production') {
    return 'Production House is not available yet. You can subscribe to Creator or Studio now.'
  }
  return 'This plan is not available yet.'
}
