"use client"

import Header from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Video, Mic, Image, HardDrive, Users, Zap, Shield, Building2, Crown, RefreshCw, Infinity } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    name: "Solo",
    price: 19,
    description: "Perfect for individual creators",
    popular: false,
    credits: "8,000 Studio Credits",
    videoStandard: "60s",
    videoCinematic: "10s",
    aiVoice: "30 min",
    images: "Uses credits",
    castingPosts: 0,
    storage: "25 GB",
    seats: 1,
    features: [
      "Watermarked outputs",
    ],
    icon: Sparkles,
    color: "from-blue-500 to-cyan-400",
  },
  {
    name: "Creator",
    price: 49,
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
      "No watermarks",
      "Brand kit",
    ],
    icon: Video,
    color: "from-purple-500 to-pink-500",
  },
  {
    name: "Studio",
    price: 149,
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
      "Team workflows",
      "Priority queue",
    ],
    icon: Users,
    color: "from-green-500 to-emerald-400",
  },
  {
    name: "Production House",
    price: 399,
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
      "API access",
      "VIP support",
    ],
    icon: Building2,
    color: "from-orange-500 to-red-500",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Custom solutions for organizations",
    popular: false,
    credits: "Custom",
    videoStandard: "Custom",
    videoCinematic: "Custom",
    aiVoice: "Custom",
    images: "Uses credits",
    castingPosts: "Custom",
    storage: "Custom",
    seats: "Custom",
    features: [
      "SSO/SAML",
      "SLAs",
      "Dedicated support",
    ],
    icon: Crown,
    color: "from-yellow-500 to-amber-500",
  },
]

export default function PlansInfoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-7xl px-6 py-12">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isPopular = plan.popular
            const isEnterprise = plan.name === "Enterprise"
            
            return (
              <Card
                key={plan.name}
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
                  <CardTitle className="text-2xl mb-1">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  
                  <div className="mt-4">
                    {isEnterprise ? (
                      <div className="text-3xl font-bold">Custom</div>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${plan.price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Credits */}
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{plan.credits}</p>
                    </div>
                  </div>

                  {/* Video Renders */}
                  <div className="flex items-start gap-2">
                    <Video className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Video renders:</span>{" "}
                        {plan.videoStandard} Standard + {plan.videoCinematic} Cinematic
                      </p>
                    </div>
                  </div>

                  {/* AI Voice */}
                  <div className="flex items-start gap-2">
                    <Mic className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">AI Voice:</span> {plan.aiVoice}
                      </p>
                    </div>
                  </div>

                  {/* Images */}
                  <div className="flex items-start gap-2">
                    <Image className="h-4 w-4 text-pink-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Images / Covers:</span> {plan.images}
                      </p>
                    </div>
                  </div>

                  {/* Casting Posts */}
                  {plan.castingPosts !== 0 && (
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">Casting posts:</span> {plan.castingPosts} included
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Storage */}
                  <div className="flex items-start gap-2">
                    <HardDrive className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Storage:</span> {plan.storage}
                      </p>
                    </div>
                  </div>

                  {/* Seats */}
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Seats:</span> {plan.seats}
                      </p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="pt-4 border-t border-border">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{feature}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={`w-full mt-6 ${
                      isPopular
                        ? "gradient-button text-white"
                        : "border-border hover:bg-primary hover:text-primary-foreground"
                    }`}
                    variant={isPopular ? "default" : "outline"}
                    asChild
                  >
                    {isEnterprise ? (
                      <Link href="/contact">Contact Sales</Link>
                    ) : (
                      <Link href="/signup">Get Started</Link>
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
                  Whether you're on Solo, Creator, Studio, or Production House, you can add more credits whenever you need them.
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
                    <Link href="/credits">Add Credits Now</Link>
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

