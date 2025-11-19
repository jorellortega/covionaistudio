# How to Sync Stripe Subscription to Database

Since webhooks aren't reaching your local server, you can manually sync subscriptions.

## Method 1: Using the Script (Easiest)

1. **Get your subscription ID from Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/subscriptions
   - Find your subscription (for vidaxci@gmail.com)
   - Copy the subscription ID (starts with `sub_`)

2. **Run the sync script:**
   ```bash
   node scripts/sync-subscription.js sub_xxxxx 78ed2283-ef51-4613-90bb-a6d3299837d4
   ```
   Replace `sub_xxxxx` with your actual subscription ID.

## Method 2: Using curl

```bash
curl -X POST http://localhost:3000/api/stripe/sync-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_xxxxx",
    "userId": "78ed2283-ef51-4613-90bb-a6d3299837d4"
  }'
```

## Method 3: Using Postman/Insomnia

1. POST to `http://localhost:3000/api/stripe/sync-subscription`
2. Body (JSON):
   ```json
   {
     "subscriptionId": "sub_xxxxx",
     "userId": "78ed2283-ef51-4613-90bb-a6d3299837d4"
   }
   ```

## Method 4: Set Up Webhook Listener (For Future)

To receive webhooks automatically in the future:

1. **Install Stripe CLI** (if not already installed):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe CLI:**
   ```bash
   stripe login
   ```

3. **Start webhook listener** (in a new terminal):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```

4. **Copy the webhook secret** (starts with `whsec_`) and add to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

5. **Restart your Next.js server**

6. **For existing subscriptions**, manually trigger webhook from Stripe Dashboard:
   - Go to your subscription
   - Click "..." → "Send test webhook"
   - Select `customer.subscription.updated`
   - Send it

## Verify It Worked

After syncing, check your database:
```sql
SELECT * FROM public.subscriptions ORDER BY created_at DESC;
```

You should see your subscription!

