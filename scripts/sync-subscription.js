// Quick script to sync a Stripe subscription to the database
// Usage: node scripts/sync-subscription.js <subscription_id> <user_id>

const subscriptionId = process.argv[2]
const userId = process.argv[3]

if (!subscriptionId || !userId) {
  console.error('Usage: node scripts/sync-subscription.js <subscription_id> <user_id>')
  console.error('Example: node scripts/sync-subscription.js sub_xxxxx 78ed2283-ef51-4613-90bb-a6d3299837d4')
  process.exit(1)
}

async function syncSubscription() {
  try {
    const response = await fetch('http://localhost:3000/api/stripe/sync-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        userId,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Error:', data.error)
      if (data.details) {
        console.error('Details:', data.details)
      }
      process.exit(1)
    }

    console.log('✅ Success! Subscription synced:')
    console.log(JSON.stringify(data.subscription, null, 2))
  } catch (error) {
    console.error('❌ Failed to sync subscription:', error.message)
    process.exit(1)
  }
}

syncSubscription()

