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
    default: "AI Cinema Production | Covion – Powered by Infinito AI",
    template: "%s | AI Cinema Production – Covion",
  },
  description:
    "Covion is an AI cinema production platform powered by Infinito AI. Plan scenes, visualize mood, and move from idea to screen in one workspace.",
  keywords: [
    "AI cinema production",
    "film production platform",
    "mood boards",
    "story development",
    "scene timeline",
    "visual development",
    "Covion",
    "Infinito AI",
  ],
  openGraph: {
    title: "AI Cinema Production | Covion – Powered by Infinito AI",
    description:
      "Plan, visualize, and build films faster. Treatments, mood boards, and timelines in one place.",
    url: "https://cinema.covion.ai/",
    siteName: "Covion",
    images: [
      {
        url: "/quantum-heist-movie-poster.png",
        width: 1200,
        height: 630,
        alt: "Covion – AI Cinema Production",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Cinema Production | Covion – Powered by Infinito AI",
    description:
      "From idea to screen—treatments, mood boards, and timelines in one workspace.",
    images: ["/quantum-heist-movie-poster.png"],
    creator: "@covion",
  },
  generator: "Covion",
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
              name: "Covion",
              applicationCategory: "CreativeWorkApplication",
              operatingSystem: "Web",
              description:
                "AI cinema production platform powered by Infinito AI. Plan scenes, visualize mood, and build timelines.",
              url: "https://cinema.covion.ai/",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              brand: {
                "@type": "Brand",
                name: "Covion",
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
