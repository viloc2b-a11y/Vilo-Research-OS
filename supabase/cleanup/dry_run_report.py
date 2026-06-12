import os
import psycopg2
import json

# Connection parameters - replace if needed
def get_conn():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST'),
        port=int(os.getenv('SUPABASE_DB_PORT', '5432')),
        dbname=os.getenv('SUPABASE_DB_NAME', 'postgres'),
        user=os.getenv('SUPABASE_DB_USER'),
        password=os.getenv('SUPABASE_DB_PASSWORD')
    )

queries = {
    "studies": """
        SELECT s.id, s.name, s.slug, s.status, s.created_source
        FROM public.studies s
        WHERE s.created_source IN ('test_seed', 'e2e_demo')
           OR s.name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
           OR COALESCE(s.slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
    """,
    "subjects": """
        SELECT ss.id, ss.subject_identifier, ss.enrollment_status, s.name AS study_name
        FROM public.study_subjects ss
        JOIN public.studies s ON s.id = ss.study_id
        WHERE ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
           OR s.created_source IN ('test_seed', 'e2e_demo')
           OR s.name ~* '(Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
    """,
    "visits": """
        SELECT v.id, v.visit_status, vd.code, vd.label, s.name AS study_name, ss.subject_identifier
        FROM public.visits v
        JOIN public.studies s ON s.id = v.study_id
        JOIN public.study_subjects ss ON ss.id = v.study_subject_id
        JOIN public.visit_definitions vd ON vd.id = v.visit_definition_id
        WHERE ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
           OR vd.code ~* '(VPI_SEED|PHASE9A-PILOT)'
           OR vd.label ~* '(VPI seed|PHASE9A-PILOT)'
           OR s.created_source IN ('test_seed', 'e2e_demo')
    """,
    "procedure_executions_source_sets_workflow": """
        WITH matched_studies AS (
            SELECT id FROM public.studies WHERE created_source IN ('test_seed','e2e_demo')
                OR name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
                OR COALESCE(slug,'') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        ), matched_subjects AS (
            SELECT ss.id FROM public.study_subjects ss WHERE ss.study_id IN (SELECT id FROM matched_studies)
                OR ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        ), matched_visits AS (
            SELECT v.id FROM public.visits v
            JOIN public.visit_definitions vd ON vd.id = v.visit_definition_id
            WHERE v.study_id IN (SELECT id FROM matched_studies)
               OR v.study_subject_id IN (SELECT id FROM matched_subjects)
               OR vd.code ~* 'VPI_SEED'
               OR vd.label ~* 'VPI seed'
        ), matched_source_sets AS (
            SELECT srs.id FROM public.source_response_sets srs
            WHERE LEFT(srs.id::text,8) IN ('3cea3f80','f0ed64b5','21533aa7','59f7a569','31152a92')
               OR srs.study_id IN (SELECT id FROM matched_studies)
               OR srs.study_subject_id IN (SELECT id FROM matched_subjects)
               OR srs.visit_id IN (SELECT id FROM matched_visits)
        )
        SELECT 'procedure_executions' AS table_name, pe.id::text, pe.study_id::text, pe.visit_id::text, pe.execution_status AS status
        FROM public.procedure_executions pe
        WHERE pe.study_id IN (SELECT id FROM matched_studies)
           OR pe.visit_id IN (SELECT id FROM matched_visits)
        UNION ALL
        SELECT 'source_response_sets', srs.id::text, srs.study_id::text, srs.visit_id::text, srs.status
        FROM public.source_response_sets srs
        WHERE srs.id IN (SELECT id FROM matched_source_sets)
        UNION ALL
        SELECT 'subject_workflow_actions', swa.id::text, swa.study_id::text, COALESCE(swa.visit_id::text, swa.source_response_set_id::text), swa.status
        FROM public.subject_workflow_actions swa
        WHERE swa.study_id IN (SELECT id FROM matched_studies)
           OR swa.study_subject_id IN (SELECT id FROM matched_subjects)
           OR swa.visit_id IN (SELECT id FROM matched_visits)
           OR swa.source_response_set_id IN (SELECT id FROM matched_source_sets)
           OR swa.title ~* '(VPI seed|VPI_SEED|QA RBAC|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)'
    """,
    "documents": """
        SELECT d.id, d.operational_display_name, d.original_filename, d.status, d.metadata
        FROM public.compliance_runtime_documents d
        LEFT JOIN public.studies s ON s.id = d.study_id
        WHERE d.operational_display_name ~* '(Reader Closure|E2E Upload|VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC|Phase 1[BCD].*Smoke|VALIDATION-PROTOCOL-001-SMOKE)'
           OR d.original_filename ~* '(VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|E2E Upload|Reader Closure)'
           OR d.operational_notes ~* '(smoke|Reader closure live validation)'
           OR d.metadata::text ~* '(smoke_test|runtime_validation|test_seed|e2e_demo)'
           OR s.created_source IN ('test_seed','e2e_demo')
    """,
    "operational_events": """
        SELECT oe.id, oe.event_type, oe.payload, s.name AS study_name
        FROM public.operational_events oe
        JOIN public.studies s ON s.id = oe.study_id
        WHERE oe.event_type ~* '(QA RBAC|Operational Calendar Manual Event|VPI_SEED|PHASE9A-PILOT)'
           OR oe.payload::text ~* '(QA RBAC|Operational Calendar Manual Event|VPI seed|VPI_SEED|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)'
           OR s.created_source IN ('test_seed','e2e_demo')
    """
}

def fetch_and_report(conn, name, query):
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
        count = len(rows)
        print(f"=== {name.upper()} ===")
        print(f"Count: {count}")
        # Show up to 3 example rows
        for row in rows[:3]:
            print(row)
        print()

def main():
    conn = get_conn()
    try:
        for name, query in queries.items():
            fetch_and_report(conn, name, query)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
