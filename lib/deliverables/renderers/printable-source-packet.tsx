import React from 'react'
import { PrintableSourcePacketEvidence } from '../types'

export function PrintableSourcePacketTemplate({
  evidence,
  runId,
  generatedBy,
}: {
  evidence: PrintableSourcePacketEvidence
  runId: string
  generatedBy: string
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{`Vilo OS - Printable Source Packet - ${evidence.subjectIdentifier}`}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          body { font-family: sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 12px; }
          h1, h2, h3 { margin-top: 0; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
          .header-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .version-stamp { background: #f3f4f6; border: 1px solid #d1d5db; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
          .procedure { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 15px; padding: 15px; page-break-inside: avoid; }
          .procedure-header { display: flex; justify-content: space-between; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 10px; }
          .field { display: flex; flex-direction: column; margin-bottom: 8px; }
          .field-label { font-size: 10px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
          .field-value { font-size: 12px; font-weight: 500; }
          .signatures { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d1d5db; }
          .signature-box { font-size: 10px; color: #4b5563; }
          .footer { font-size: 10px; color: #9ca3af; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        `}} />
      </head>
      <body>
        <div className="header">
          <h1>Source Evidence Packet</h1>
          <div className="header-grid">
            <div><strong>Study ID:</strong> {evidence.studyHeader.studyId}</div>
            <div><strong>Protocol:</strong> {evidence.studyHeader.protocolId}</div>
            <div><strong>Subject ID:</strong> {evidence.subjectIdentifier}</div>
            <div><strong>Visit Name:</strong> {evidence.visitInfo.visitName}</div>
            <div><strong>Visit Date:</strong> {evidence.visitInfo.visitDate ? new Date(evidence.visitInfo.visitDate).toLocaleDateString() : 'N/A'}</div>
            <div><strong>Status:</strong> {evidence.visitInfo.status}</div>
          </div>
        </div>

        <div className="version-stamp">
          <strong>Execution Version Lock (VERSION_USED_DURING_EXECUTION):</strong><br />
          Source Package: {evidence.sourcePackage.name} (ID: {evidence.sourcePackage.id})<br />
          <em style={{ fontSize: '10px' }}>This packet reflects the exact clinical blueprint used at the time of data collection.</em>
        </div>

        <h2>Procedures</h2>
        {evidence.procedures.length === 0 ? (
          <p>No procedures found for this visit.</p>
        ) : (
          evidence.procedures.map((proc) => (
            <div key={proc.id} className="procedure">
              <div className="procedure-header">
                <h3 style={{ margin: 0 }}>{proc.name}</h3>
                <span>Status: {proc.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {proc.fields.filter(f => !f.isInternal).map((field, idx) => (
                  <div key={idx} className="field">
                    <span className="field-label">{field.label}</span>
                    <span className="field-value">{field.value || '-'} {field.unit}</span>
                  </div>
                ))}
              </div>
              
              {proc.signatures.length > 0 && (
                <div className="signatures">
                  <strong>Signatures:</strong>
                  {proc.signatures.map((sig, idx) => (
                    <div key={idx} className="signature-box">
                      {sig.meaning} - {sig.signer} ({sig.role}) at {sig.signedAt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <h2>Document Lineage / Attachments</h2>
        {evidence.attachments.length === 0 ? (
          <p style={{ fontSize: '11px' }}>No attachments for this visit.</p>
        ) : (
          <ul>
            {evidence.attachments.map(att => (
              <li key={att.id} style={{ fontSize: '11px' }}>{att.filename} (v{att.version}) - Uploaded {att.uploadedAt}</li>
            ))}
          </ul>
        )}

        <div className="footer">
          Generated at {new Date().toISOString()} by {generatedBy}<br/>
          Deliverable Run ID: {runId}
        </div>
      </body>
    </html>
  )
}
