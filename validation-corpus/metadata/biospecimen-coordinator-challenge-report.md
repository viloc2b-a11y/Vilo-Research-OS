# Biospecimen Coordinator Challenge Mode

*This document simulates the Q&A testing engine to validate the newly generated VIP Biospecimen Patterns.*

### Scenario 1: Processing Delay
**Q:** Blood collected at 09:00. Protocol requires centrifugation within 30 minutes. Actual centrifugation at 10:05. What happens?
**A:** This is a Time-to-Processing protocol deviation. The sample may be scientifically invalid. The site must document the deviation, notify the sponsor, and process the sample anyway while marking it "Protocol Deviation" on the lab requisition.

### Scenario 2: Courier Failure
**Q:** FedEx lost shipment containing primary PK endpoints. What is required?
**A:** Immediate sponsor notification. The PI must evaluate if subject recollection is medically safe, scientifically viable (within window), and permitted by the protocol. A major deviation is logged.

### Scenario 3: Temperature Failure During Transit
**Q:** Dry ice arrived melted at the Central Lab. Samples are at ambient temperature. What is required?
**A:** The Central Lab will quarantine the samples and issue a Query. The site must investigate the shipment preparation (did they use enough dry ice?). The sponsor will likely reject the samples for analysis.

### Scenario 4: Labeling Error
**Q:** Specimen label mismatch (Tube says SUBJ-01, Requisition says SUBJ-02). What is required?
**A:** Central Lab halts accessioning. A Data Clarification Form (DCF) is issued to the site. The site must trace the Chain of Custody log and phlebotomy source document to determine the true identity. If identity cannot be 100% verified, the sample must be destroyed.

### Scenario 5: Aliquot Discrepancy
**Q:** Protocol requires 4 aliquots. Site only generated 3. What is required?
**A:** Site ships the 3 aliquots, logs the discrepancy on the shipping manifest (e.g., "Insufficient volume drawn"), and files a minor protocol deviation for the missing backup aliquot.

### Scenario 6: Equipment Failure
**Q:** Site -80C freezer breaks down on a weekend. What is required?
**A:** The automated temperature monitor must alert staff. Staff must transfer samples to the designated backup -80C freezer within the validated timeframe, document the transfer in the Chain of Custody log, and submit the temperature logger data to the sponsor to prove samples did not thaw.

*(Note: The full 100-question suite is mathematically generated during runtime utilizing the patterns in `protocol-intelligence-patterns.candidate.json`).*
