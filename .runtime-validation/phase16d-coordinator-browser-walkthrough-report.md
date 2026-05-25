# Phase 16D — Live Coordinator Browser Walkthrough

**Run at:** 2026-05-25T01:03:52.350Z
**Recommendation (browser):** GO

## Environment
- App: http://localhost:3000
- Coordinator: calendar.qa.coordinator@vilo-os.staging

## Routes completed
- login
- command-center
- study-workspace
- subject-workspace
- visit
- capture

## Friction log

### Step 1 (medium)
- **Sees:** Headless login did not redirect off /login
- **Expected:** Form sign-in redirects to command center within a few seconds
- **Actual:** Form redirect timed out; cookie session fallback cookies=1 ok=true
- **Fix:** Investigate client router.refresh after sign-in in headless browsers
- **Pilot impact:** Manual browser sign-in likely fine; automate with session for CI

### Step 12 (low)
- **Sees:** Save draft button disabled or absent
- **Expected:** Mutable sets allow draft save
- **Actual:** Save draft not enabled (likely already submitted)
- **Fix:** Show read-only state clearly when submitted
- **Pilot impact:** Expected for pilot fixture; document for coordinators

### Step 17 (medium)
- **Sees:** Browser console: Failed to load resource: the server responded with a status of 400 ()
- **Expected:** No client errors during walkthrough
- **Actual:** 1 console error(s)
- **Fix:** Fix client exceptions on visit/capture routes
- **Pilot impact:** May indicate broken UI paths
