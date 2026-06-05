import React from 'react'
import { ConsentEvidencePackageEvidence } from '../types'

export function ConsentEvidencePackageTemplate({
  evidence,
  runId,
  generatedBy,
}: {
  evidence: ConsentEvidencePackageEvidence
  runId: string
  generatedBy: string
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{`Vilo OS - Consent Evidence Package - ${evidence.subjectIdentifier}`}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          body { font-family: sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 12px; }
          h1, h2, h3 { margin-top: 0; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
          .header-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .status-banner { padding: 10px; border-radius: 4px; margin-bottom: 20px; font-weight: bold; }
          .status-active { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .status-pending { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
          .status-withdrawn { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
          .section { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 15px; padding: 15px; page-break-inside: avoid; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background: #f9fafb; font-size: 10px; color: #6b7280; text-transform: uppercase; }
          .footer { font-size: 10px; color: #9ca3af; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        `}} />
      </head>
      <body>
        <div className="header">
          <h1>Consent Evidence Package</h1>
          <div className="header-grid">
            <div><strong>Study ID:</strong> {evidence.studyHeader.studyId}</div>
            <div><strong>Protocol:</strong> {evidence.studyHeader.protocolId}</div>
            <div><strong>Subject ID:</strong> {evidence.subjectIdentifier}</div>
          </div>
        </div>

        <div className={`status-banner status-${evidence.statusSummary.currentStatus === 'active' ? 'active' : (evidence.statusSummary.currentStatus === 'withdrawn' ? 'withdrawn' : 'pending')}`}>
          Current Status: {evidence.statusSummary.currentStatus.toUpperCase()}
          {evidence.statusSummary.requiresReconsent && " (Requires Reconsent)"}
        </div>

        <h2>Consent Timeline</h2>
        <div className="section">
          {evidence.timeline.length === 0 ? (
            <p>No consent history found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidence.timeline.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString()}</td>
                    <td>{t.type}</td>
                    <td>{t.versionName || '-'}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2>Consent Document Versions</h2>
        <div className="section">
          {evidence.documents.length === 0 ? (
            <p>No consent documents found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Type</th>
                  <th>IRB Approval</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidence.documents.map(d => (
                  <tr key={d.id}>
                    <td>{d.versionName}</td>
                    <td>{d.consentType}</td>
                    <td>{d.irbApprovalDate ? new Date(d.irbApprovalDate).toLocaleDateString() : 'N/A'}</td>
                    <td>{new Date(d.effectiveDate).toLocaleDateString()}</td>
                    <td>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2>Signatures</h2>
        <div className="section">
          {evidence.signatures.length === 0 ? (
            <p>No signatures found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Signer</th>
                  <th>Role</th>
                  <th>Meaning</th>
                  <th>Method</th>
                  <th>Signed At</th>
                </tr>
              </thead>
              <tbody>
                {evidence.signatures.map((sig, idx) => (
                  <tr key={idx}>
                    <td>{sig.signer}</td>
                    <td>{sig.role}</td>
                    <td>{sig.meaning}</td>
                    <td>{sig.method}</td>
                    <td>{new Date(sig.signedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2>Paper Uploads / Attachments</h2>
        <div className="section">
          {evidence.attachments.length === 0 ? (
            <p>No attachments found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Uploaded At</th>
                  <th>Current?</th>
                </tr>
              </thead>
              <tbody>
                {evidence.attachments.map(att => (
                  <tr key={att.id}>
                    <td>{att.filename}</td>
                    <td>{new Date(att.uploadedAt).toLocaleString()}</td>
                    <td>{att.isCurrent ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="footer">
          Generated at {new Date().toISOString()} by {generatedBy}<br/>
          Deliverable Run ID: {runId}
        </div>
      </body>
    </html>
  )
}
