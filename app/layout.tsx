import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/AuthProvider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Ai Cinema Studio – AI-Powered Film Production Platform",
    template: "%s | Ai Cinema Studio",
  },
  description:
    "Ai Cinema Studio is an AI-powered cinema production platform. Plan scenes, visualize mood, and move from idea to screen in one workspace. Powered by Infinito AI.",
  keywords: [
    "AI cinema production",
    "film production platform",
    "mood boards",
    "story development",
    "scene timeline",
    "visual development",
    "Ai Cinema Studio",
    "AI filmmaking",
    "cinema production software",
    "Infinito AI",
  ],
  openGraph: {
    title: "Ai Cinema Studio – AI-Powered Film Production Platform",
    description:
      "Plan, visualize, and build films faster. Treatments, mood boards, and timelines in one place. From idea to screen in one workspace.",
    url: "https://cinema.covion.ai/",
    siteName: "Ai Cinema Studio",
    images: [
      {
        url: "/quantum-heist-movie-poster.png",
        width: 1200,
        height: 630,
        alt: "Ai Cinema Studio – AI-Powered Film Production",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ai Cinema Studio – AI-Powered Film Production Platform",
    description:
      "From idea to screen—treatments, mood boards, and timelines in one workspace.",
    images: ["/quantum-heist-movie-poster.png"],
    creator: "@aicinemastudio",
  },
  generator: "Ai Cinema Studio",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <style>{`
html {
  font-family: ${inter.style.fontFamily};
  --font-sans: ${inter.style.fontFamily};
  --font-mono: ${jetbrainsMono.style.fontFamily};
}
        `}</style>
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Ai Cinema Studio",
              applicationCategory: "CreativeWorkApplication",
              operatingSystem: "Web",
              description:
                "AI-powered cinema production platform. Plan scenes, visualize mood, and build timelines. From idea to screen in one workspace.",
              url: "https://cinema.covion.ai/",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              brand: {
                "@type": "Brand",
                name: "Ai Cinema Studio",
              },
            }),
          }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
