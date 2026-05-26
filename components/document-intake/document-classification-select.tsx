'use client'



interface DocumentClassificationSelectProps {
  value: string
  onChange: (value: string) => void
}

export function DocumentClassificationSelect({ value, onChange }: DocumentClassificationSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Document Classification</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 p-2 text-sm"
      >
        <option value="" disabled>Select a classification</option>
        <option value="source_document">Source Document</option>
        <option value="external_medical_record">External Medical Record</option>
        <option value="lab_result">Lab Result</option>
        <option value="imaging">Imaging</option>
        <option value="regulatory_document">Regulatory Document</option>
        <option value="protocol">Protocol</option>
        <option value="protocol_amendment">Protocol Amendment</option>
        <option value="investigator_brochure">Investigator Brochure</option>
        <option value="training_material">Training Material</option>
        <option value="delegation_document">Delegation Document</option>
        <option value="financial_document">Financial Document</option>
        <option value="safety_document">Safety Document</option>
        <option value="vendor_document">Vendor Document</option>
        <option value="site_communication">Site Communication</option>
        <option value="pharmacy_document">Pharmacy Document</option>
        <option value="monitoring_document">Monitoring Document</option>
        <option value="other">Other</option>
      </select>
    </div>
  )
}
