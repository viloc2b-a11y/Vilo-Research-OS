import { SupabaseClient } from '@supabase/supabase-js'

export const COMPLIANCE_STORAGE_BUCKET = 'operational-documents'

export interface UploadDocumentBlobArgs {
  supabase: SupabaseClient
  storagePath: string
  file: File
}

export async function uploadDocumentBlob(args: UploadDocumentBlobArgs): Promise<{ ok: boolean; message?: string }> {
  const { error } = await args.supabase.storage
    .from(COMPLIANCE_STORAGE_BUCKET)
    .upload(args.storagePath, args.file, {
      contentType: args.file.type,
      upsert: false
    })

  if (error) {
    return { ok: false, message: `Failed to upload document blob: ${error.message}` }
  }

  return { ok: true }
}
