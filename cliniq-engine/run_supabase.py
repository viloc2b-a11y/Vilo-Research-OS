"""
Smoke test for the Supabase-backed ClinIQ engine.
Run: python run_supabase.py
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment (.env file).
"""

from dotenv import load_dotenv
load_dotenv()

from soa.parser import parse_soa_to_expected_billables
from finance.handlers_supabase import seed_expected_billables, handle_visit_completed
from events.store_supabase import get_all, get_leakage_summary

STUDY_ID = "smoke-test-001"
SOA_PATH = "mock_soa.csv"

def main():
    print("=== ClinIQ Supabase Smoke Test ===\n")

    billables = parse_soa_to_expected_billables(SOA_PATH)
    print(f"[1] Parsed {len(billables)} billables from {SOA_PATH}")

    seed_expected_billables(billables, STUDY_ID)
    print(f"[2] Seeded into expected_billables")

    for visit in ["Screening Visit", "Baseline Visit"]:
        triggered = handle_visit_completed(visit, STUDY_ID)
        print(f"[3] {visit}: triggered {len(triggered)} item(s)")

    leakage = get_leakage_summary(STUDY_ID)
    print(f"[4] Leakage: {len(leakage)} pending item(s)")
    for row in leakage:
        print(f"    !! {row.get('visit_name')} | {row.get('line_code')} | ${row.get('amount')}")

    events = get_all()
    mine = [e for e in events if e.payload.get("study_id") == STUDY_ID]
    print(f"[5] {len(mine)} event(s) logged for {STUDY_ID}")
    print("\n=== Done ===")

if __name__ == "__main__":
    main()
