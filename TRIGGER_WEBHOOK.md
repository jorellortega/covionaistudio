# How to Trigger Webhook for Existing Subscription

Since your webhook secret is set, you can manually trigger a webhook for your existing subscription.

## Method 1: From Stripe Dashboard (Easiest)

1. Go to: https://dashboard.stripe.com/test/subscriptions
2. Click on your subscription (for vidaxci@gmail.com)
3. Click the **"..."** menu (three dots) in the top right
4. Select **"Send test webhook"**
5. Choose event type: **`customer.subscription.updated`**
6. Click **"Send test webhook"**

This will send the webhook to your local server and it should save to the database.

## Method 2: Using Stripe CLI

```bash
# Get your subscription ID first from Stripe Dashboard
# Then trigger the event:
stripe trigger customer.subscription.updated --override subscription:id=sub_xxxxx
```

Replace `sub_xxxxx` with your actual subscription ID.

## Method 3: Manual Sync (Fastest)

If webhooks still don't work, just sync it manually:

1. Get subscription ID from Stripe Dashboard
2. Open browser console on localhost:3000
3. Run:
```javascript
fetch('/api/stripe/sync-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscriptionId: 'sub_xxxxx', // Your subscription ID
    userId: '78ed2283-ef51-4613-90bb-a6d3299837d4'
  })
}).then(r => r.json()).then(console.log)
```

## Check Your Server Logs

After triggering, check your Next.js server terminal. You should see:
- `📥 Webhook received!`
- `🔔 Received Stripe webhook event: customer.subscription.updated`
- `✅ Subscription saved to database:`

If you see errors, they'll help us debug!

