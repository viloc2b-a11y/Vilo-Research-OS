-- Extends subject_consent_documents.document_kind to include 'certified_copy'.
-- Required for hybrid consent workflows: a paper form that has been digitally
-- scanned and certified is distinct from the original ICF or HIPAA auth.

ALTER TABLE subject_consent_documents
  DROP CONSTRAINT subject_consent_documents_kind_check;

ALTER TABLE subject_consent_documents
  ADD CONSTRAINT subject_consent_documents_kind_check
    CHECK (document_kind IN (
      'icf',
      'hipaa',
      'optional_consent',
      'withdrawal',
      'source_document',
      'other',
      'certified_copy'
    ));
