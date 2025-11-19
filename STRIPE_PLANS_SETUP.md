# Stripe Plans Setup Guide

This guide will help you create the remaining subscription plans in Stripe to match your pricing.

## Current Plans

- ✅ **Creator Plan**: $60/month (Already created)
- ⏳ **Studio Plan**: $150/month (Need to create)
- ⏳ **Production House Plan**: $500/month (Need to create)

## Step-by-Step: Creating Plans in Stripe Dashboard

### 1. Create Studio Plan

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Click **"+ Add product"** button
3. Fill in the details:
   - **Name**: `Studio Plan`
   - **Description**: `Studio subscription plan.`
   - **Pricing model**: Select **"Recurring"**
   - **Price**: `$150.00`
   - **Billing period**: `Monthly`
   - **Currency**: `USD`
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`) - you'll need this for your environment variables

### 2. Create Production House Plan

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Click **"+ Add product"** button
3. Fill in the details:
   - **Name**: `Production House Plan`
   - **Description**: `Production House subscription plan.`
   - **Pricing model**: Select **"Recurring"**
   - **Price**: `$500.00`
   - **Billing period**: `Monthly`
   - **Currency**: `USD`
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`) - you'll need this for your environment variables

## Step 3: Update Environment Variables

After creating both plans, update your `.env.local` file with the new Price IDs:

```env
# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PRICE_CREATOR=price_xxxxx_creator_price_id
STRIPE_PRICE_STUDIO=price_xxxxx_studio_price_id
STRIPE_PRICE_PRODUCTION=price_xxxxx_production_price_id
```

**Note**: You can remove `STRIPE_PRICE_SOLO` since we removed the Solo plan.

## Step 4: Verify Your Setup

1. Check that all three plans are visible in Stripe Dashboard
2. Verify the prices match:
   - Creator: $60/month
   - Studio: $150/month
   - Production House: $500/month
3. Make sure you've copied all Price IDs correctly

## Important Notes

- **Test Mode**: Make sure you're creating these in Test Mode first (toggle in top right of Stripe Dashboard)
- **Price IDs**: Each plan has a unique Price ID that starts with `price_`
- **Product vs Price**: In Stripe, a Product can have multiple Prices. For monthly subscriptions, you typically have one Price per Product.
- **Currency**: All prices should be in USD

## Troubleshooting

### Can't find the Price ID?
- Go to the Product page in Stripe Dashboard
- Click on the product name
- Scroll down to the "Pricing" section
- The Price ID is shown next to each price (you can click the copy icon)

### Price shows in cents?
- Stripe stores prices in cents in the API, but the Dashboard shows dollars
- $150 = 15000 cents
- $500 = 50000 cents
- The code handles this conversion automatically

