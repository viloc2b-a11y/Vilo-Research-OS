'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      // We pass redirectTo to the current origin + /reset-password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        throw resetError
      }
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : String(resetError ?? '')
      if (/failed to fetch|fetch failed|network/i.test(message)) {
        setError('Unable to reach the authentication service. Check your network connection or DNS settings, then try again.')
      } else {
        setError(message || 'Unable to send reset instructions. Please try again.')
      }
      setLoading(false)
      return
    }

    // We do not reveal if the email exists. Always show success.
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="vilo-login-page flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your email to receive a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If an account exists for that email, we have sent password reset instructions.
              </p>
              <Button onClick={() => router.push('/login')} className="w-full" variant="outline">
                Return to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending link…' : 'Send reset link'}
              </Button>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="text-center">
                <Link href="/login" className="text-xs font-medium text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
