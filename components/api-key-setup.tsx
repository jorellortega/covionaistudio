"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Key, Eye, EyeOff } from "lucide-react"
import { OpenAIService } from "@/lib/openai-service"
import { useAuth } from "@/components/AuthProvider"

export function ApiKeySetup() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState(user?.openaiApiKey || "")
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    message: string
  } | null>(null)

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({
        isValid: false,
        message: "Please enter your OpenAI API key"
      })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      const isValid = await OpenAIService.validateApiKey(apiKey)
      
      if (isValid) {
        setValidationResult({
          isValid: true,
          message: "API key validated successfully! Please save it in your settings."
        })
      } else {
        setValidationResult({
          isValid: false,
          message: "Invalid API key. Please check your key and try again."
        })
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: "Error validating API key. Please try again."
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemoveApiKey = async () => {
    setApiKey("")
    setValidationResult(null)
  }

  if (user?.openaiApiKey) {
    return (
      <Card className="cinema-card border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-500">
            <CheckCircle className="h-5 w-5" />
            OpenAI API Key Configured
          </CardTitle>
          <CardDescription>
            You can now use ChatGPT for scripts and DALL-E for images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              API Key: {showKey ? "••••••••••••••••" : "••••••••••••••••"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              className="h-6 w-6 p-0"
            >
              {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveApiKey}
            className="border-red-500/20 text-red-500 hover:bg-red-500/10"
          >
            Remove API Key
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="cinema-card border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-500">
          <Key className="h-5 w-5" />
          Set Up OpenAI API Key
        </CardTitle>
        <CardDescription>
          Add your OpenAI API key to use ChatGPT for scripts and DALL-E for images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">OpenAI API Key</Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              className="px-3"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {validationResult && (
          <Alert className={validationResult.isValid ? "border-green-500/20" : "border-red-500/20"}>
            {validationResult.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <AlertDescription className={validationResult.isValid ? "text-green-500" : "text-red-500"}>
              {validationResult.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSaveApiKey}
            disabled={isValidating || !apiKey.trim()}
            className="gradient-button text-white"
          >
            {isValidating ? "Validating..." : "Save API Key"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Platform</a></p>
          <p>• Your API key is stored locally and never shared</p>
          <p>• You'll be charged by OpenAI based on your usage</p>
        </div>
      </CardContent>
    </Card>
  )
}
