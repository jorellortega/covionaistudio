"use client"

import { useState } from "react"
import Header from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Check, Video, Mic, Image, Users, Zap, Shield, Building2, RefreshCw, Loader2, AlertTriangle, FileText, Film, X, Sparkles, UserCircle, ScanFace, MapPin, Box, Type, Play, FolderOpen, Package, List } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/AuthProvider"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  isSubscriptionPlanPurchasable,
  subscriptionPlanUnavailableMessage,
} from "@/lib/signup-config"

type PricedPlanId = "creator" | "studio" | "production"

const DEFAULT_PLAN_BILLING: Record<PricedPlanId, "monthly" | "annual"> = {
  creator: "monthly",
  studio: "monthly",
  production: "monthly",
}

/** Annual price already reflects discount vs 12× monthly — returns $ and % saved. */
function annualDiscountVsMonthly(priceMonthly: number, priceAnnual: number) {
  const fullYearAtMonthly = priceMonthly * 12
  const dollarsSaved = fullYearAtMonthly - priceAnnual
  const pct =
    fullYearAtMonthly > 0 ? Math.round((dollarsSaved / fullYearAtMonthly) * 100) : 0
  return { fullYearAtMonthly, dollarsSaved, pct }
}

type FeatureGroup = { title: string; items: string[] }

const WRITE_FEATURES = ["Workspace", "Treatments", "Screenplay"]
const WORLD_FEATURES = [
  "Characters",
  "Avatars",
  "Locations",
  "Objects",
  "Create Cover",
  "Create Voice",
  "Create Titles",
  "Prompt Create",
]
const BOARD_FEATURES = ["Movies", "Timeline", "Storyboards", "Shot List", "Assets"]
const PAPERWORK_FEATURES = [
  "Casting",
  "Lighting Plot",
  "Call Sheet",
  "Crew Sheet",
  "Equipment List",
  "Props List",
]

function featureGroupsForPlan(includeCinemaProduction: boolean): FeatureGroup[] {
  return [
    { title: "Write & develop", items: WRITE_FEATURES },
    { title: "World & assets", items: WORLD_FEATURES },
    {
      title: "Board & produce",
      items: includeCinemaProduction
        ? [...BOARD_FEATURES, "Cinema Production"]
        : BOARD_FEATURES,
    },
    { title: "Set paperwork", items: PAPERWORK_FEATURES },
  ]
}

const FEATURE_ICONS: Record<string, { Icon: typeof Check; className: string }> = {
  Workspace: { Icon: Sparkles, className: "text-blue-400" },
  Treatments: { Icon: FileText, className: "text-blue-400" },
  Screenplay: { Icon: FileText, className: "text-orange-400" },
  Characters: { Icon: UserCircle, className: "text-purple-400" },
  Avatars: { Icon: ScanFace, className: "text-fuchsia-400" },
  Locations: { Icon: MapPin, className: "text-emerald-400" },
  Objects: { Icon: Box, className: "text-amber-400" },
  "Create Cover": { Icon: Image, className: "text-pink-400" },
  "Create Voice": { Icon: Mic, className: "text-cyan-400" },
  "Create Titles": { Icon: Type, className: "text-sky-400" },
  "Prompt Create": { Icon: Sparkles, className: "text-violet-400" },
  Movies: { Icon: Film, className: "text-green-400" },
  Timeline: { Icon: Play, className: "text-green-400" },
  Storyboards: { Icon: Image, className: "text-indigo-400" },
  "Shot List": { Icon: List, className: "text-pink-400" },
  Assets: { Icon: FolderOpen, className: "text-teal-400" },
  "Cinema Production": { Icon: Video, className: "text-rose-400" },
  Casting: { Icon: Users, className: "text-cyan-400" },
  "Lighting Plot": { Icon: Zap, className: "text-yellow-400" },
  "Call Sheet": { Icon: FileText, className: "text-orange-400" },
  "Crew Sheet": { Icon: Users, className: "text-lime-400" },
  "Equipment List": { Icon: Package, className: "text-slate-400" },
  "Props List": { Icon: Box, className: "text-amber-400" },
}

const plans = [
  {
    id: "creator",
    name: "Creator",
    nameAlt: "Script Writer",
    price: 45,
    /** Stripe yearly price ($360/yr in dashboard) — shown when Annual is selected */
    annualPrice: 360,
    description: "For professional creators",
    popular: true,
    credits: "25,000 Studio Credits",
    videoStandard: "300s",
    videoCinematic: "60s",
    aiVoice: "120 min",
    images: "Uses credits",
    castingPosts: 1,
    storage: "250 GB",
    seats: 1,
    featureGroups: featureGroupsForPlan(false),
    excludedFeatures: ["Cinema Production"],
    cinemaProduction: false,
    icon: Video,
    color: "from-purple-500 to-pink-500",
  },
  {
    id: "studio",
    name: "Studio",
    nameAlt: "Script Writer and Producer",
    price: 150,
    annualPrice: 1440,
    description: "For production teams",
    popular: false,
    credits: "90,000 Studio Credits",
    videoStandard: "900s",
    videoCinematic: "240s",
    aiVoice: "600 min",
    images: "Uses credits",
    castingPosts: 3,
    storage: "1 TB",
    seats: 5,
    featureGroups: featureGroupsForPlan(true),
    excludedFeatures: [] as string[],
    cinemaProduction: true,
    icon: Users,
    color: "from-green-500 to-emerald-400",
  },
  {
    id: "production",
    name: "Production House",
    nameAlt: "Writer and Executive Producer",
    price: 500,
    annualPrice: 4800,
    description: "For large production companies",
    popular: false,
    credits: "220,000 Studio Credits",
    videoStandard: "2,400s",
    videoCinematic: "600s",
    aiVoice: "2,000 min",
    images: "Uses credits",
    castingPosts: 10,
    storage: "3 TB",
    seats: 15,
    featureGroups: featureGroupsForPlan(true),
    excludedFeatures: [] as string[],
    cinemaProduction: true,
    icon: Building2,
    color: "from-orange-500 to-red-500",
  },
]

export default function SubscriptionsPage() {
  const { loading: authLoading } = useAuth()
  const { userId, signedIn, user, session } = useAuthReady()
  const { toast } = useToast()
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  /** Which plan card looks “selected” — default Creator (Most Popular). */
  const [focusedPlanId, setFocusedPlanId] = useState<string>("creator")
  /** Per-plan Stripe checkout interval (monthly vs yearly). */
  const [planBilling, setPlanBilling] =
    useState<Record<PricedPlanId, "monthly" | "annual">>(DEFAULT_PLAN_BILLING)

  const checkoutLoadingKey = (planId: string) =>
    `${planId}:${planBilling[planId as PricedPlanId]}`

  const handleSubscribe = async (planId: string) => {
    setFocusedPlanId(planId)
    if (!isSubscriptionPlanPurchasable(planId)) {
      toast({
        title: "Not available yet",
        description: subscriptionPlanUnavailableMessage(planId),
        variant: "destructive",
      })
      return
    }
    // New users: sign up first (same page returns them here to finish in-app if needed)
    if (!signedIn) {
      const qs = new URLSearchParams({
        mode: "signup",
        next: "/subscriptions",
        plan: planId,
      })
      qs.set("billing", planBilling[planId as PricedPlanId])
      router.push(`/login?${qs.toString()}`)
      return
    }

    setLoadingPlan(checkoutLoadingKey(planId))
    try {
      // Get email from user object or session
      const userEmail = user?.email || session?.user?.email
      
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userId,
          userEmail,
          action: "subscribe",
          billingInterval: planBilling[planId as PricedPlanId],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout. Please try again.",
        variant: "destructive",
      })
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-7xl px-6 py-12">
        <Alert className="mb-8 border-primary/30 bg-primary/5">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <AlertTitle className="text-lg font-semibold">
            Creator is available now
          </AlertTitle>
          <AlertDescription className="text-base text-muted-foreground mt-1">
            Studio and Production House plans are not available yet. You can subscribe to Creator today.
          </AlertDescription>
        </Alert>
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            AI Cinema Studio — Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Monthly or annual billing — pick per plan before checkout
          </p>
          <Badge variant="outline" className="mt-4">
            Annual plans include the discount vs 12× monthly (~20% on Studio &amp; Production House at current prices)
          </Badge>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isPopular = plan.popular
            const isSelected = focusedPlanId === plan.id
            const isLoading = loadingPlan === checkoutLoadingKey(plan.id)
            const billing = planBilling[plan.id as PricedPlanId]
            const hasAnnual = "annualPrice" in plan && plan.annualPrice != null
            const displayPrice =
              hasAnnual && billing === "annual" && plan.annualPrice != null
                ? plan.annualPrice
                : plan.price
            const displaySuffix = hasAnnual && billing === "annual" ? "/year" : "/month"
            const annualDiscount =
              hasAnnual && plan.annualPrice != null
                ? annualDiscountVsMonthly(plan.price, plan.annualPrice)
                : null
            const isPurchasable = isSubscriptionPlanPurchasable(plan.id)

            return (
              <Card
                key={plan.id}
                onClick={() => setFocusedPlanId(plan.id)}
                className={`cinema-card relative overflow-hidden transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "border-primary shadow-lg z-10 scale-[1.02] sm:scale-105 ring-2 ring-primary/20"
                    : "hover:border-primary/50 hover:shadow-md"
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-1">
                    {plan.name}
                    {plan.nameAlt && (
                      <span className="text-base font-normal text-muted-foreground block mt-1">
                        (alternative: {plan.nameAlt})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>

                  {hasAnnual && (
                    <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-muted-foreground mb-2">Billing</p>
                      <ToggleGroup
                        type="single"
                        value={billing}
                        onValueChange={(v) => {
                          if (v === "monthly" || v === "annual") {
                            setPlanBilling((prev) => ({
                              ...prev,
                              [plan.id as PricedPlanId]: v,
                            }))
                          }
                        }}
                        variant="outline"
                        className="grid w-full grid-cols-2 gap-2"
                      >
                        <ToggleGroupItem value="monthly" className="text-sm">
                          Monthly
                        </ToggleGroupItem>
                        <ToggleGroupItem value="annual" className="text-sm">
                          Annual
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <span className="text-3xl font-bold">${displayPrice}</span>
                    <span className="text-muted-foreground">{displaySuffix}</span>
                  </div>
                  {hasAnnual && annualDiscount && (
                    <p
                      className={`mt-2 text-xs leading-snug ${
                        billing === "annual"
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {billing === "annual" ? (
                        <>
                          vs ${annualDiscount.fullYearAtMonthly.toLocaleString()} if you paid monthly for 12
                          months — save ${annualDiscount.pct}% (
                          ${annualDiscount.dollarsSaved.toLocaleString()})
                        </>
                      ) : (
                        <>
                          Annual saves ~{annualDiscount.pct}% (
                          ${annualDiscount.dollarsSaved.toLocaleString()}) vs 12 monthly payments
                        </>
                      )}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {plan.featureGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </p>
                      {group.items.map((feature) => {
                        const meta = FEATURE_ICONS[feature]
                        const Icon = meta?.Icon || Check
                        const iconColor = meta?.className || "text-primary"
                        return (
                          <div key={feature} className="flex items-start gap-2">
                            <Icon className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                            <p className="text-sm font-medium">{feature}</p>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {plan.excludedFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{feature}</p>
                        <p className="text-xs text-muted-foreground">Not included — no access to the video production page</p>
                      </div>
                    </div>
                  ))}

                  {/* Additional Features with Checkmarks */}
                  <div className="pt-4 border-t border-border">
                    {/* Credits */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{plan.credits}</p>
                    </div>

                    {/* Video Renders / Cinema Production */}
                    {plan.cinemaProduction ? (
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Video renders:</span>{" "}
                          {plan.videoStandard} Standard + {plan.videoCinematic} Cinematic
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2">
                        <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Cinema Production page:</span> not included
                        </p>
                      </div>
                    )}

                    {/* AI Voice */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">AI Voice:</span> {plan.aiVoice}
                      </p>
                    </div>

                    {/* Images */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Images / Covers:</span> {plan.images}
                      </p>
                    </div>

                    {/* Casting Posts */}
                    {plan.castingPosts !== 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Casting posts:</span> {plan.castingPosts} included
                        </p>
                      </div>
                    )}

                    {/* Storage */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Storage:</span> {plan.storage}
                      </p>
                    </div>

                    {/* Seats */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Seats:</span> {plan.seats}
                      </p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={`w-full mt-6 ${
                      isPurchasable && isSelected
                        ? "gradient-button text-white"
                        : "border-border hover:bg-primary hover:text-primary-foreground"
                    }`}
                    variant={isPurchasable && isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleSubscribe(plan.id)
                    }}
                    disabled={!isPurchasable || isLoading || authLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : !isPurchasable ? (
                      "Coming soon"
                    ) : signedIn ? (
                      "Subscribe Now"
                    ) : (
                      "Sign up to subscribe"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Credit Reload Card */}
        <div className="mb-12">
          <Card className="cinema-card border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    Add credits when you need them
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Each plan includes a monthly credit allowance. When you run low, purchase more credits—no confusing cap on how often you can top up.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-foreground leading-relaxed">
                  AI features and renders draw from your credit balance. Creator, Studio, and Production House each include credits with the subscription; when you&apos;ve used them, buy additional credit packs to keep working—same plan, same workspace.
                </p>
                <div className="flex items-start gap-2 pt-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Stay on your current plan</span> — top up credits without changing tiers
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">No upgrade required to buy more</span> — purchase packs whenever your balance runs low
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Buy packs as often as you like</span> — there&apos;s no limit on how many times you can add credits to the same plan
                  </p>
                </div>
                <div className="pt-4">
                  <Button className="gradient-button text-white" asChild>
                    <Link href="/settings/plans-credits">Add Credits Now</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info Section */}
        <div className="mt-16 text-center">
          <Card className="cinema-card max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-2">Annual Billing Discount</CardTitle>
              <CardDescription>
                Save approximately 20% when you choose annual billing on all paid plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 text-primary">
                <Shield className="h-5 w-5" />
                <p className="text-sm">
                  All plans include our standard features and regular updates
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            Need help choosing a plan?{" "}
            <Link href="/contact" className="text-primary hover:underline">
              Contact our sales team
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

