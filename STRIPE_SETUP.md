# Stripe Integration Setup Guide

This guide will help you set up Stripe for payment processing and webhook handling in your Cinema Studio application.

## Prerequisites

1. A Stripe account (sign up at [stripe.com](https://stripe.com))
2. Stripe CLI installed on your local machine

## Step 1: Install Stripe CLI

### macOS
```bash
brew install stripe/stripe-cli/stripe
```

### Windows
Download from: https://github.com/stripe/stripe-cli/releases

### Linux
```bash
# Download and install from releases page
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

## Step 2: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Test Mode** keys:
   - **Secret Key** (starts with `sk_test_`)
   - **Publishable Key** (starts with `pk_test_`)

3. Add them to your `.env.local` file:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

## Step 3: Set Up Local Webhook Listener

### 1. Login to Stripe CLI
```bash
stripe login
```

This will open your browser to authenticate with your Stripe account.

### 2. Forward Events to Your Local Server

Run the Stripe CLI listener to forward webhook events to your local development server:

**Option 1: Use default Next.js port (3000)**
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

**Option 2: Use port 4242 (as shown in Stripe dashboard)**
```bash
# First, start Next.js on port 4242:
PORT=4242 npm run dev

# Then in another terminal, run:
stripe listen --forward-to localhost:4242/api/webhook
```

**Note:** Adjust the port number to match your Next.js dev server port.

### 3. Get Your Webhook Secret

When you run `stripe listen`, you'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Copy the `whsec_...` value and add it to your `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 4. Restart Your Development Server

After adding the webhook secret, restart your Next.js dev server:
```bash
npm run dev
```

## Step 4: Test Webhook Events

### Trigger Test Events

You can trigger test events using the Stripe CLI:

```bash
# Test payment intent succeeded
stripe trigger payment_intent.succeeded

# Test checkout session completed
stripe trigger checkout.session.completed

# Test subscription created
stripe trigger customer.subscription.created
```

### Monitor Webhook Events

You can see all webhook events in your terminal where `stripe listen` is running. You should also see logs in your Next.js server console.

## Step 5: Production Setup

When deploying to production:

1. **Create a Webhook Endpoint in Stripe Dashboard:**
   - Go to [Webhooks](https://dashboard.stripe.com/webhooks)
   - Click "Add endpoint"
   - Enter your production URL: `https://yourdomain.com/api/webhook`
   - Select events to listen to
   - Copy the webhook signing secret

2. **Update Environment Variables:**
   - Use production Stripe keys (starts with `sk_live_` and `pk_live_`)
   - Use the production webhook secret from the dashboard

## Webhook Events Handled

The webhook handler currently processes these events:

- `payment_intent.succeeded` - Successful payment
- `payment_intent.payment_failed` - Failed payment
- `checkout.session.completed` - Checkout completed
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed

## Next Steps

1. **Implement Database Updates:**
   - Update the TODO sections in `/app/api/webhook/route.ts`
   - Add functions to update user credits/subscriptions in your database

2. **Create Checkout Sessions:**
   - Build checkout pages using Stripe Checkout or Payment Intents
   - Link from your pricing page (`/plans-info`)

3. **Handle Subscription Management:**
   - Create pages for users to manage their subscriptions
   - Handle plan upgrades/downgrades

## Troubleshooting

### Webhook signature verification fails
- Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
- Restart both `stripe listen` and your Next.js server after updating env vars

### Events not reaching your server
- Check that `stripe listen` is running
- Verify the port in `--forward-to` matches your Next.js dev server port
- Check firewall/network settings

### Test mode vs Live mode
- Make sure you're using test keys (`sk_test_`) for development
- Use `stripe listen` for local testing
- Use Stripe Dashboard webhooks for production

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

