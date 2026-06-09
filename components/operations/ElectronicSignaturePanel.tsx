'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signOperationalRequest } from '@/lib/operations/signature-actions'

type ElectronicSignaturePanelProps = {
  requestId: string
  signatureMeaning: string
  attestationText: string
  requiredRole: string
  status: 'pending' | 'signed' | 'cancelled' | 'superseded'
  onSigned?: () => void
}

export function ElectronicSignaturePanel({
  requestId,
  signatureMeaning,
  attestationText,
  requiredRole,
  status,
  onSigned
}: ElectronicSignaturePanelProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSign = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const result = await signOperationalRequest(requestId, pin, attestationText)
      if (!result.ok) throw new Error(result.error)
      if (onSigned) onSigned()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signature failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'signed') {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-sm text-green-800">Signature Completed</CardTitle>
          <CardDescription className="text-xs text-green-700">{signatureMeaning}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Electronic Signature Required</CardTitle>
        <CardDescription className="text-sm">
          Role Required: {requiredRole} | Meaning: {signatureMeaning}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-3 rounded-md text-sm italic">
          &quot;{attestationText}&quot;
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Enter eSignature PIN</label>
          <Input 
            type="password" 
            inputMode="numeric"
            maxLength={6}
            placeholder="6 digits" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)} 
          />
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
        </div>

        <Button onClick={handleSign} disabled={isLoading || !pin}>
          {isLoading ? 'Signing...' : 'Sign and Complete'}
        </Button>
      </CardContent>
    </Card>
  )
}
