'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateDeliverableAction, getDeliverableDownloadUrl } from '@/lib/deliverables/actions'
import type { SubjectDeliverablesModel } from '@/lib/subject/deliverables/load-subject-deliverables'
import { FileText, Download, Loader2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SubjectDeliverablesSection({
  model,
  subjectId,
  studyId,
  organizationId,
  userId,
}: {
  model: SubjectDeliverablesModel
  subjectId: string
  studyId: string
  organizationId: string
  userId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadingOutput, setDownloadingOutput] = useState<string | null>(null)

  const handleGenerateConsentPackage = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const result = await generateDeliverableAction({
        systemCode: 'consent_evidence_package',
        organizationId,
        userId,
        audience: 'coordinator',
        scope: 'subject',
        filters: { studyId, subjectId }
      })
      
      if (!result.success) {
        throw new Error((result as any).error as string || 'Failed to generate package')
      }
      
      // Refresh to see new output
      startTransition(() => {
        router.refresh()
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGeneratePrintableSourcePacket = async (visitInstanceId: string) => {
    if (!visitInstanceId) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const result = await generateDeliverableAction({
        systemCode: 'printable_source_packet',
        organizationId,
        userId,
        audience: 'coordinator',
        scope: 'visit',
        filters: { studyId, subjectId, visitInstanceId }
      })
      
      if (!result.success) {
        throw new Error((result as any).error as string || 'Failed to generate source packet')
      }
      
      // Refresh to see new output
      startTransition(() => {
        router.refresh()
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (storagePath: string) => {
    setDownloadingOutput(storagePath)
    setError(null)
    try {
      const res = await getDeliverableDownloadUrl(storagePath)
      if (res.success && res.signedUrl) {
        window.open(res.signedUrl, '_blank')
      } else {
        throw new Error(res.error || 'Failed to get download URL')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDownloadingOutput(null)
    }
  }

  // Find latest consent package run
  const consentRuns = model.deliverableRuns.filter(r => r.systemCode === 'consent_evidence_package')
  const latestConsentRun = consentRuns.length > 0 ? consentRuns[0] : null
  const hasConsentOutputs = latestConsentRun?.outputs && latestConsentRun.outputs.length > 0

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Consent Evidence Package
            </CardTitle>
            <CardDescription>
              Generates a regulatory package of all consent versions, patient signatures, and optional permissions for this subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 rounded-md bg-muted/20 border p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-foreground">Latest Package</span>
                <span className="text-muted-foreground text-xs">
                  {latestConsentRun 
                    ? new Date(latestConsentRun.completedAt || latestConsentRun.startedAt || '').toLocaleString() 
                    : 'Never generated'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  {latestConsentRun ? `Status: ${latestConsentRun.status}` : 'No outputs available.'}
                </span>
                {hasConsentOutputs ? (
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={downloadingOutput === latestConsentRun.outputs[0].storagePath}
                    onClick={() => handleDownload(latestConsentRun.outputs[0].storagePath)}
                  >
                    {downloadingOutput === latestConsentRun.outputs[0].storagePath ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-3.5 w-3.5" />
                    )}
                    Download
                  </Button>
                ) : null}
              </div>
            </div>
            <Button 
              className="w-full"
              disabled={isGenerating || isPending}
              onClick={handleGenerateConsentPackage}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Generate Consent Evidence Package
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Printable Source Packet
            </CardTitle>
            <CardDescription>
              Generates a printable clinical source document for a specific visit, based on the version used during execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Visit</label>
              <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a visit..." />
                </SelectTrigger>
                <SelectContent>
                  {model.visitInstances.map((visit) => (
                    <SelectItem key={visit.id} value={visit.id} disabled={!visit.sourcePackageId}>
                      {visit.visitName} {visit.visitDate ? `(${visit.visitDate})` : ''} - {visit.status} {!visit.sourcePackageId ? '(No Source)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedVisitId && (
              <div className="flex flex-col gap-2 rounded-md bg-muted/20 border p-3">
                {(() => {
                  const runsForVisit = model.deliverableRuns.filter(r => r.systemCode === 'printable_source_packet' && r.visitInstanceId === selectedVisitId)
                  const latestVisitRun = runsForVisit.length > 0 ? runsForVisit[0] : null
                  const hasVisitOutputs = latestVisitRun?.outputs && latestVisitRun.outputs.length > 0
                  
                  return (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-foreground">Visit Source Packet</span>
                        <span className="text-muted-foreground text-xs">
                          {latestVisitRun 
                            ? new Date(latestVisitRun.completedAt || latestVisitRun.startedAt || '').toLocaleString() 
                            : 'Never generated'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {latestVisitRun ? `Status: ${latestVisitRun.status}` : 'No outputs available.'}
                        </span>
                        {hasVisitOutputs ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled={downloadingOutput === latestVisitRun.outputs[0].storagePath}
                            onClick={() => handleDownload(latestVisitRun.outputs[0].storagePath)}
                          >
                            {downloadingOutput === latestVisitRun.outputs[0].storagePath ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            
            <Button 
              className="w-full"
              disabled={isGenerating || isPending || !selectedVisitId}
              onClick={() => handleGeneratePrintableSourcePacket(selectedVisitId)}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Generate Source Packet
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliverables History</CardTitle>
          <CardDescription>
            Recent deliverables generated for this subject.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {model.deliverableRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No deliverables generated for this subject.</p>
            ) : (
              model.deliverableRuns.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">{run.deliverableName}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {run.status} · Generated {new Date(run.startedAt || '').toLocaleString()}
                    </p>
                  </div>
                  {run.outputs && run.outputs.length > 0 && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-8"
                      disabled={downloadingOutput === run.outputs[0].storagePath}
                      onClick={() => handleDownload(run.outputs[0].storagePath)}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download {run.outputs[0].format.toUpperCase()}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
