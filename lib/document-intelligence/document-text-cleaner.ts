const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g
const MRN_PATTERN = /\b(?:MRN|medical record|patient id)[:\s#-]*[A-Z0-9-]{6,}\b/gi
const LONG_ID_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g

/**
 * Basic pattern redaction for retrieval chunks.
 * Not certified de-identification — operational hygiene only.
 */
export function cleanDocumentText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(MRN_PATTERN, '[REDACTED_ID]')
    .replace(LONG_ID_PATTERN, '[REDACTED_ID]')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
