const PROCEDURE_BULLET_RE = /^\s*(?:-|\*|\u2022|\d+\.|Procedure:)\s*([A-Za-z][^\n]{2,120})/gim
const line = "Procedure: Unscheduled Sick Assessment (conditional) — sick visit if respiratory symptoms worsen"
for (const match of line.matchAll(PROCEDURE_BULLET_RE)) {
  console.log("MATCH:", match[1])
}
