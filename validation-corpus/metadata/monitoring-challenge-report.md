# Monitoring Challenge Report (Representative Matrix)

*Note: This report contains a representative sample of high-fidelity CRA challenge scenarios. The VIP engine mathematically extrapolates these rules to thousands of permutations using the injected candidate patterns.*

### Scenario 1: Missing Timestamp
- **CRA Finds:** Source document says "Blood drawn", but time is blank.
- **Decision:** Issue Data Query & SDV Action Item.
- **Reason:** Breaks ALCOA+ (Contemporaneous).
- **Evidence/Docs Required:** NTF or source correction using secondary evidence (e.g., ECG time).
- **Audit/CAPA Impact:** Minor deviation. If trending, triggers CAPA.

### Scenario 2: Unresolved Query Open > 45 Days
- **CRA Finds:** A query regarding a missing AE severity has been ignored for 48 days.
- **Decision:** Escalate to PI; Withhold Visit Payment.
- **Reason:** Severe lack of data management oversight.
- **Financial Impact:** High. Sponsor halts invoice processing for that visit.

### Scenario 3: Training Expired
- **CRA Finds:** CRC processed samples, but IATA training expired 1 month ago.
- **Decision:** Major Deviation. Suspend CRC from shipping duties.
- **Reason:** Federal aviation violation; GCP training violation.
- **CAPA Impact:** Immediate retraining required. Sponsor QA notified.

### Scenario 4: Missing PI Signature on Lab
- **CRA Finds:** Central lab report with Grade 3 liver enzyme elevation unsigned by PI.
- **Decision:** Critical Safety Finding. Immediate Medical Monitor escalation.
- **Reason:** PI Oversight failure. Safety signal ignored.
- **Audit Impact:** Highly likely to generate an FDA Form 483 if discovered during BIMO inspection.

### Scenario 5: Drug Accountability Mismatch
- **CRA Finds:** Subject returned 5 fewer pills than math allows.
- **Decision:** Major Finding / IP Accountability Deviation.
- **Reason:** IP is highly regulated. Lost IP implies diversion, poor subject compliance, or CRC math errors.
- **Financial Impact:** Sponsor may audit pharmacy. No direct visit withholding unless fraud is suspected.
