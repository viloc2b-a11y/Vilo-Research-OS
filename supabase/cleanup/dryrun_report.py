import os
import psycopg2
import json

def get_conn():
    host = os.getenv('SUPABASE_DB_HOST')
    port = os.getenv('SUPABASE_DB_PORT', '5432')
    dbname = os.getenv('SUPABASE_DB_NAME', 'postgres')
    user = os.getenv('SUPABASE_DB_USER', 'postgres')
    password = os.getenv('SUPABASE_DB_PASSWORD')
    if not all([host, password]):
        raise RuntimeError('Missing required Supabase DB env vars')
    conn = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=password)
    return conn

def run_query(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
        colnames = [desc[0] for desc in cur.description]
    return colnames, rows

def main():
    conn = get_conn()
    sections = []
    # Define dry-run queries (extracted from the SQL file)
    queries = [
        # studies
        """select 'studies' as table_name, s.id, s.organization_id, s.name, s.slug, s.status, s.created_source, s.created_at
        from public.studies s
        where s.created_source in ('test_seed', 'e2e_demo')
            or s.name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
            or coalesce(s.slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        order by s.created_at desc limit 5;""",
        # subjects
        """select 'study_subjects' as table_name, ss.id, ss.organization_id, ss.study_id, s.name as study_name, ss.subject_identifier, ss.enrollment_status, ss.created_at
        from public.study_subjects ss
        join public.studies s on s.id = ss.study_id
        where ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
            or s.created_source in ('test_seed', 'e2e_demo')
            or s.name ~* '(Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        order by ss.created_at desc limit 5;""",
        # visits
        """select 'visits' as table_name, v.id, v.organization_id, v.study_id, s.name as study_name, ss.subject_identifier, vd.code as visit_code, vd.label as visit_label, v.visit_status, v.scheduled_date, v.created_at
        from public.visits v
        join public.studies s on s.id = v.study_id
        join public.study_subjects ss on ss.id = v.study_subject_id
        join public.visit_definitions vd on vd.id = v.visit_definition_id
        where ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
            or vd.code ~* '(VPI_SEED|PHASE9A-PILOT)'
            or vd.label ~* '(VPI seed|PHASE9A-PILOT)'
            or s.created_source in ('test_seed', 'e2e_demo')
        order by v.created_at desc limit 5;""",
        # procedure_executions and related tables (combined)
        """with matched_studies as (
            select id from public.studies where created_source in ('test_seed', 'e2e_demo')
                or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
                or coalesce(slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        ), matched_subjects as (
            select ss.id from public.study_subjects ss where ss.study_id in (select id from matched_studies)
                or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
        ), matched_visits as (
            select v.id from public.visits v join public.visit_definitions vd on vd.id = v.visit_definition_id
            where v.study_id in (select id from matched_studies)
                or v.study_subject_id in (select id from matched_subjects)
                or vd.code ~* 'VPI_SEED'
                or vd.label ~* 'VPI seed'
        ), matched_source_sets as (
            select srs.id from public.source_response_sets srs
            where left(srs.id::text, 8) in ('3cea3f80','f0ed64b5','21533aa7','59f7a569','31152a92')
                or srs.study_id in (select id from matched_studies)
                or srs.study_subject_id in (select id from matched_subjects)
                or srs.visit_id in (select id from matched_visits)
        )
        select 'procedure_executions' as table_name, pe.id::text as id, pe.study_id::text as study_id, pe.visit_id::text as parent_id, pe.execution_status as status
        from public.procedure_executions pe where pe.study_id in (select id from matched_studies) or pe.visit_id in (select id from matched_visits)
        limit 5;""",
        # compliance_runtime_documents
        """select 'compliance_runtime_documents' as table_name, d.id, d.organization_id, d.study_id, d.operational_display_name, d.original_filename, d.status, d.metadata, d.created_at
        from public.compliance_runtime_documents d
        left join public.studies s on s.id = d.study_id
        where d.operational_display_name ~* '(Reader Closure|E2E Upload|VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC|Phase 1[BCD].*Smoke|VALIDATION-PROTOCOL-001-SMOKE)'
            or d.original_filename ~* '(VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|E2E Upload|Reader Closure)'
            or d.operational_notes ~* '(smoke|Reader closure live validation)'
            or d.metadata::text ~* '(smoke_test|runtime_validation|test_seed|e2e_demo)'
            or s.created_source in ('test_seed', 'e2e_demo')
        order by d.created_at desc limit 5;""",
        # operational_events
        """select 'operational_events' as table_name, oe.id, oe.organization_id, oe.study_id, s.name as study_name, oe.event_type, oe.payload, oe.occurred_at
        from public.operational_events oe join public.studies s on s.id = oe.study_id
        where oe.event_type ~* '(QA RBAC|Operational Calendar Manual Event|VPI_SEED|PHASE9A-PILOT)'
            or oe.payload::text ~* '(QA RBAC|Operational Calendar Manual Event|VPI seed|VPI_SEED|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)'
            or s.created_source in ('test_seed', 'e2e_demo')
        order by oe.occurred_at desc limit 5;"""
    ]
    results = []
    for sql in queries:
        colnames, rows = run_query(conn, sql)
        # count total matching rows (without limit) is not available due to limit; we also run a count query separately
        count_sql = sql.replace('limit 5', '')
        count_sql = f"select count(*) from ({count_sql}) as sub"
        _, count_row = run_query(conn, count_sql)
        count = count_row[0][0]
        results.append({
            'section': rows[0][0] if rows else 'unknown',
            'table_name': rows[0][0] if rows else None,
            'count': count,
            'examples': [dict(zip(colnames, r)) for r in rows]
        })
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
