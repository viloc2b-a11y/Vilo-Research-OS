# Runtime Implementation Sequence

## 1. Overview
To clear the blockers and achieve MVP Runtime Execution, the development must be sequenced into small, deterministic sprints.

## 2. Sprint 1: The Execution Guard (Hard Stops)
*Objective: Build the barrier.*
- **Task 1.1:** Develop the `InterventionModal` React Server Component.
- **Task 1.2:** Implement the `vipGuard` middleware in Server Actions to intercept data mutations, evaluate VIP Intelligence, and return a `HARD_STOP` payload if necessary.
- **Task 1.3:** Wire the double-signature UI into the Intervention Modal.

## 3. Sprint 2: The Defense Alert System (Advisories)
*Objective: Build the radar without causing fatigue.*
- **Task 2.1:** Create the `site_defense_alerts` Supabase table.
- **Task 2.2:** Build the `DefenseBanner` UI component to render ADVISORY/WARNING states globally across the layout.
- **Task 2.3:** Implement the backend Alert Throttling logic (suppressing duplicate LOW alerts).

## 4. Sprint 3: The Medical Authority Workflow
*Objective: Achieve FDA Audit Defensibility.*
- **Task 3.1:** Create the `medical_adjudications` Supabase table.
- **Task 3.2:** Build the `PIOversightInbox` for the Principal Investigator.
- **Task 3.3:** Wire the CS/NCS toggles to electronic Part 11-compliant signatures.

## 5. Final Gateway
Upon completing Sprint 3, Vilo OS will have the physical "muscles" to execute the "brain" developed in the VIP Memory JSON. This will unlock the Production Pilot.
