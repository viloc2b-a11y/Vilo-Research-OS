# Study Setup Wizard Final UI Validation

## Validation Matrix
| Step | UI Component | Server Action Used | Persistence Used | Can coordinator complete from UI? | P0 missing? |
|---|---|---|---|---|---|
| 1. Study Information | `StudyInformationForm` | `updateStudyInfo` | `studies` table | Yes | No |
| 2. Site Selection | `SiteSelectionPanel` | `linkStudySite` | `organization_id` bindings | Yes | No |
| 3. Team Assignment | `StudyTeamAssignment` | `assignStudyMember` | `study_members` | Yes | No |
| 4. Protocol Training Log | `ProtocolTrainingLog` | `createProtocolTraining` | `study_protocol_trainings` | Yes | No |
| 5. Protocol Delegation Log | `ProtocolDelegationLog` | `createDelegationLog` | `study_delegation_log` | Yes | No |
| 6. Document Intake | `DocumentIntakePanel` | `uploadDocument` | `compliance_runtime_documents` | Yes | No |
| 7. Source Package Review | `SourceStudioWrapper` | `publishSourcePackage` | `source_packages` | Yes | No |
| 8. Runtime Binding | `RuntimeBindingPanel` | `bindSourcePackageToVisits` | `study_runtime_visits` | Yes | No |
| 9. Enrollment Configuration| `EnrollmentConfigPanel` | `upsertEnrollmentConfig` | `study_enrollment_configs` | Yes | No |
| 10. Activation Readiness | `ReadinessChecklist` | `checkActivationReadiness` | (Read-only aggregation) | Yes | No |
| 11. Activate Study | `StudyActivationButton` | `activateStudy` | `studies.status` | Yes | No |

## Final Report
No internal governance internals or SQL is exposed. The coordinator only sees operational outcomes (Ready, Warning, Blocked).
Unblinded domains are dynamically hidden based on Step 1 configuration.
