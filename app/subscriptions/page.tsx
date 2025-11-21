"use client"

import { useState } from "react"
import Header from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Video, Mic, Image, HardDrive, Users, Zap, Shield, Building2, RefreshCw, Infinity, Loader2, AlertTriangle, FileText, Film, Camera, BookOpen, LayoutGrid, Palette } from "lucide-react"
import Link from "next/link"
import { useAuthReady } from "@/components/auth-hooks"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const plans = [
  {
    id: "creator",
    name: "Creator",
    nameAlt: "Script Writer",
    price: 45,
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
    features: [
      "Treatments",
      "Synopsis",
      "Scenes",
      "Screenplay",
      "Shotlist",
    ],
    icon: Video,
    color: "from-purple-500 to-pink-500",
  },
  {
    id: "studio",
    name: "Studio",
    nameAlt: "Script Writer and Producer",
    price: 150,
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
    features: [
      "Treatments",
      "Synopsis",
      "Scenes",
      "Screenplay",
      "Shotlist",
      "Casting",
      "Storyboards",
      "Mood boards",
    ],
    icon: Users,
    color: "from-green-500 to-emerald-400",
  },
  {
    id: "production",
    name: "Production House",
    nameAlt: "Writer and Executive Producer",
    price: 500,
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
    features: [
      "Treatments",
      "Synopsis",
      "Scenes",
      "Screenplay",
      "Shotlist",
      "Casting",
      "Storyboards",
      "Mood boards",
      "Visual development",
    ],
    icon: Building2,
    color: "from-orange-500 to-red-500",
  },
]

export default function SubscriptionsPage() {
  const { userId, ready, signedIn, user, session } = useAuthReady()
  const { toast } = useToast()
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSubscribe = async (planId: string) => {
    // If user is not signed in, redirect to login
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent('/subscriptions')}`)
      return
    }

    setLoadingPlan(planId)
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
          action: 'subscribe',
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
        {/* Warning Banner */}
        <Alert variant="destructive" className="mb-8 border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <AlertTitle className="text-lg font-semibold text-orange-600 dark:text-orange-400">
            Do Not Sign Up Yet
          </AlertTitle>
          <AlertDescription className="text-base text-orange-700 dark:text-orange-300 mt-1">
            We will be ready to go live in January 2026. Please check back then!
          </AlertDescription>
        </Alert>
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            AI Cinema Studio — Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Creator / Producer Plans (Monthly)
          </p>
          <Badge variant="outline" className="mt-4">
            Annual billing: ~20% off all paid plans
          </Badge>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isPopular = plan.popular
            const isLoading = loadingPlan === plan.id
            
            return (
              <Card
                key={plan.id}
                className={`cinema-card relative overflow-hidden transition-all duration-300 ${
                  isPopular
                    ? "border-primary shadow-lg scale-105 ring-2 ring-primary/20"
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
                  
                  <div className="mt-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features with Icons */}
                  {plan.features.map((feature, index) => {
                    let Icon
                    let iconColor = "text-primary"
                    
                    switch(feature) {
                      case "Treatments":
                        Icon = FileText
                        iconColor = "text-blue-400"
                        break
                      case "Synopsis":
                        Icon = BookOpen
                        iconColor = "text-purple-400"
                        break
                      case "Scenes":
                        Icon = Film
                        iconColor = "text-green-400"
                        break
                      case "Screenplay":
                        Icon = FileText
                        iconColor = "text-orange-400"
                        break
                      case "Shotlist":
                        Icon = Camera
                        iconColor = "text-pink-400"
                        break
                      case "Casting":
                        Icon = Users
                        iconColor = "text-cyan-400"
                        break
                      case "Storyboards":
                        Icon = Image
                        iconColor = "text-indigo-400"
                        break
                      case "Mood boards":
                        Icon = LayoutGrid
                        iconColor = "text-yellow-400"
                        break
                      case "Visual development":
                        Icon = Palette
                        iconColor = "text-teal-400"
                        break
                      default:
                        Icon = Check
                    }
                    
                    return (
                      <div key={index} className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                        <div>
                          <p className="text-sm font-medium">{feature}</p>
                        </div>
                      </div>
                    )
                  })}

                  {/* Additional Features with Checkmarks */}
                  <div className="pt-4 border-t border-border">
                    {/* Credits */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{plan.credits}</p>
                    </div>

                    {/* Video Renders */}
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Video renders:</span>{" "}
                        {plan.videoStandard} Standard + {plan.videoCinematic} Cinematic
                      </p>
                    </div>

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
                      isPopular
                        ? "gradient-button text-white"
                        : "border-border hover:bg-primary hover:text-primary-foreground"
                    }`}
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isLoading || !ready}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : signedIn ? (
                      "Subscribe Now"
                    ) : (
                      "Sign In to Subscribe"
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
                  <CardTitle className="text-2xl flex items-center gap-2">
                    Unlimited Usage
                    <Infinity className="h-5 w-5 text-primary" />
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Load up credits on any plan for unlimited usage
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-foreground leading-relaxed">
                  Don't let credit limits hold you back! You can reload credits on any plan at any time to keep creating without interruption. 
                  Whether you're on Creator, Studio, or Production House, you can add more credits whenever you need them.
                </p>
                <div className="flex items-start gap-2 pt-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Stay on your current plan</span> — reload credits as many times as you need without changing plans
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">No plan upgrade required</span> — add credits to your existing plan whenever you need more
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Unlimited reloads</span> — keep reloading on the same plan for continuous, unlimited usage
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

