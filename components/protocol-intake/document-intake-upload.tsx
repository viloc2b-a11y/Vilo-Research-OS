'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { processDocumentIntakeUploadAction } from '@/lib/protocol-intake/extractors/document-intake-actions'

export function DocumentIntakeUploadForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    try {
      const formData = new FormData(event.currentTarget)
      const result = await processDocumentIntakeUploadAction(formData)
      if (!result.ok) {
        setError(result.error || 'Upload failed')
      } else {
        router.push(`/source-builder/intake/schedule/${result.draftId}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
      
      <div className="space-y-2">
        <Label htmlFor="studyId">Study ID</Label>
        <Input 
          id="studyId" 
          name="studyId" 
          placeholder="e.g. STUDY-KOA-001 or UUID" 
          required 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Schedule Document (PDF or Excel)</Label>
        <Input 
          id="file" 
          name="file" 
          type="file" 
          accept=".pdf,.xlsx"
          required 
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Extracting...' : 'Extract Matrix'}
      </Button>
    </form>
  )
}
