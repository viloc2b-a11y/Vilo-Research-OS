# Monitoring Financial Intelligence

## 1. Overview
Clinical sites are businesses. Sponsors are businesses. Compliance failures directly impact cash flow. VIP now understands the financial leverage Sponsors use to enforce GCP.

## 2. Financial Impact Matrix

### 1. Open Queries Delaying DB Lock
- **Revenue Risk:** Very High.
- **Business Impact:** Sponsors cannot run statistical analysis or submit to the FDA until the database is locked. If a site ignores queries, the Sponsor will withhold ALL pending payments across the entire study until the site cleans the data.

### 2. Repeated Major Deviations
- **Revenue Risk:** High.
- **Business Impact:** If data is scientifically unusable (e.g., missed primary endpoint windows), the Sponsor invokes the Clinical Trial Agreement (CTA) clause allowing them to deny payment for that specific visit. The site did the work, but gets paid $0.

### 3. Missing Source Corrections
- **Revenue Risk:** Moderate.
- **Business Impact:** Withholding of SDV (Source Data Verification) completion. Many CTAs link 20-30% of the visit payment to "SDV Complete" status.

### 4. Failed Monitoring Visits
- **Revenue Risk:** Severe (Site Reputation).
- **Business Impact:** If an audit or monitoring visit goes terribly, the site is flagged as "High Risk" in the Sponsor's Feasibility Database. The site will not be selected for future trials, resulting in long-term revenue collapse.

### 5. Missing Endpoint Data
- **Revenue Risk:** Absolute.
- **Business Impact:** Data is the only product a clinical trial produces. If the primary endpoint data is lost (e.g., lost biospecimen, corrupted imaging), the visit is financially void.
