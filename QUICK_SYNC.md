# Quick Fix: Sync Your Subscription

Since webhooks aren't working yet, let's manually sync your subscription.

## Step 1: Get Subscription ID from Stripe

1. Go to: https://dashboard.stripe.com/test/subscriptions
2. Find the subscription for `vidaxci@gmail.com` 
3. Click on it
4. Copy the subscription ID (starts with `sub_`)

## Step 2: Sync It

**Option A: Using the API directly**

Open your browser console or use curl:

```javascript
// In browser console (on localhost:3000)
fetch('/api/stripe/sync-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscriptionId: 'sub_xxxxx', // Replace with your subscription ID
    userId: '78ed2283-ef51-4613-90bb-a6d3299837d4'
  })
}).then(r => r.json()).then(console.log)
```

**Option B: Using curl**

```bash
curl -X POST http://localhost:3000/api/stripe/sync-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_xxxxx",
    "userId": "78ed2283-ef51-4613-90bb-a6d3299837d4"
  }'
```

Replace `sub_xxxxx` with your actual subscription ID from Stripe.

## Step 3: Verify

```sql
SELECT * FROM public.subscriptions ORDER BY created_at DESC;
```

## For Future: Fix Webhooks

1. Check the terminal where `stripe listen` is running
2. Look for: `> Ready! Your webhook signing secret is whsec_xxxxx`
3. Add to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```
4. Restart your Next.js server

