# Deviation Prevention Intelligence

## 1. Overview
Protocol Deviations are the primary metric the FDA uses to judge if a site is "in control" of the clinical trial. VIP's goal is to track time, resources, and rules to prevent the deviation from ever crystallizing into reality.

## 2. Prevention Vectors

### Visit Window Deviation
- **What the CRA will see:** Visit 4 occurred on Day 32 (Window was Day 28 ± 2).
- **VIP Defense:** "Visit 4 window closes in 48 hours. Subject is unscheduled. Probability of Deviation: 80%. Action: Trigger urgent scheduling task to recruitment team."

### Expired Lab Kit Deviation
- **What the CRA will see:** Blood drawn using a tube that expired last month. Lab rejects sample. Primary endpoint lost.
- **VIP Defense:** "Inventory scanning detects Kit #402 expires in 5 days. Action: VIP quarantines Kit #402 in the inventory system, preventing the CRC from assigning it to tomorrow's visit."

### Pending Eligibility Deviation
- **What the CRA will see:** Subject randomized, but inclusion criterion #4 (Chest X-Ray) was never performed.
- **VIP Defense:** "Attempting randomization without X-Ray source document attached. Probability of Critical Deviation: 100%. Action: Hard Stop. Randomization module locked until X-Ray is verified."

## 3. Site Impact
A site with near-zero deviations is considered an "Elite Site" by CROs and Sponsors. It massively reduces the CAPA burden on the site's Quality Assurance staff.
