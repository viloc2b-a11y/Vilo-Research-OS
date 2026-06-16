"use client"

import { useState } from 'react'
import { AlertCircle, FileText } from 'lucide-react'
import {
  SiteRates,
  StudyParameters,
  StartupHours,
  VisitModel,
  OpsModel,
  CloseoutModel,
  SiteChargemaster,
  NegotiationScenarioResponse,
  FinancialCertaintyLevel,
  NEGOTIATION_SCENARIOS,
  formatAmount,
  generateChargemasterSummary
} from '@/lib/cliniq-core/analysis/negotiation-engine'

export default function NegotiationClient() {
  const [rates, setRates] = useState<SiteRates>({
    pi_hourly_salary: 95,
    crc_hourly_salary: 28,
    rn_hourly_salary: 38,
    benefits_pct: 30,
    overhead_pct: 28,
    margin_pct: 15,
    billable_time_pct: 20,
    inflation_pct: 5
  })

  const [study, setStudy] = useState<StudyParameters>({
    total_visits: 12,
    total_patients: 10,
    study_years: 2,
    expected_amendments: 2,
    expected_screen_failures: 5,
    expected_cra_changes: 1,
    cta_available: false
  })

  const [visitModel, setVisitModel] = useState<VisitModel>({
    pi_hrs: 1.75,
    crc_hrs: 4,
    rn_hrs: 1,
    room_fee: 101,
    supply_cost: 45
  })

  const [startupHours, setStartupHours] = useState<StartupHours>({
    irb_hrs: 8,
    proto_pi_hrs: 4,
    proto_crc_hrs: 6,
    pharmacy_hrs: 6,
    lab_hrs: 4,
    docs_hrs: 5,
    vendor_count: 2,
    vendor_hrs_each: 4,
    bca_hrs: 6,
    mock_hrs: 3,
    gcp_hrs: 4
  })

  const ops_model: OpsModel = {
    amend_pi_hrs: 2, amend_crc_hrs: 5, reconsent_crc_hrs: 1.5,
    cra_change_crc_hrs: 5, sae_pi_hrs: 1, unscheduled_crc_hrs: 0.75,
    helpdesk_monthly_hrs: 3, remote_monthly_hrs: 4
  }

  const closeout_model: CloseoutModel = {
    closeout_crc_hrs: 8, irb_close_hrs: 3, pharmacy_close_hrs: 4,
    packaging_hrs: 5, storage_annual: 300, retention_years: 15,
    destruction_hrs: 2, destruction_ext_cost: 250, unexpected_fund: 2500,
    retrieval_hrs: 3
  }

  const [chargemaster, setChargemaster] = useState<SiteChargemaster | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [scenarioError, setScenarioError] = useState("")

  const [selectedScenarioId, setSelectedScenarioId] = useState("")
  const [scenarioResponse, setScenarioResponse] = useState<NegotiationScenarioResponse | null>(null)
  const [summaryText, setSummaryText] = useState("")
  const certainty: FinancialCertaintyLevel = chargemaster?.certainty ?? "REQUIRES_CLINIQ"

  const computeChargemaster = async () => {
    setLoading(true)
    setErrorMsg("")
    setScenarioError("")
    setSummaryText("")
    try {
      const res = await fetch('/api/negotiation/chargemaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rates,
          study,
          visit_model: visitModel,
          startup_hours: startupHours,
          ops_model,
          closeout_model,
          tpi_hrs: 3,
          tpi_avg_amount: 2000
        })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? "Failed to calculate costs")
      }
      setChargemaster(data as SiteChargemaster)
      setScenarioResponse(null)
      setSelectedScenarioId("")
    } catch (err: unknown) {
      setChargemaster(null)
      setScenarioResponse(null)
      setSelectedScenarioId("")
      setSummaryText("")
      setErrorMsg(err instanceof Error ? err.message : "Failed to calculate costs")
    } finally {
      setLoading(false)
    }
  }

  const fetchScenarioResponse = async (scenario_id: string) => {
    setSelectedScenarioId(scenario_id)
    setScenarioError("")
    if (!scenario_id) {
      setScenarioResponse(null)
      return
    }

    if (!chargemaster) {
      setScenarioError("Run the cost calculator first to unlock scenario guidance.")
      setScenarioResponse(null)
      return
    }

    try {
      setScenarioLoading(true)
      setScenarioResponse(null)
      const res = await fetch('/api/negotiation/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id, chargemaster })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? "Failed to calculate scenario response")
      }
      setScenarioResponse(data as NegotiationScenarioResponse)
    } catch (err) {
      setScenarioResponse(null)
      setScenarioError(err instanceof Error ? err.message : "Failed to calculate scenario response")
    } finally {
      setScenarioLoading(false)
    }
  }

  const generateSummary = () => {
    if (!chargemaster) return
    setSummaryText(generateChargemasterSummary(chargemaster, "My Site"))
  }

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-50 overflow-hidden">
      {/* LEFT COLUMN */}
      <div className="w-full md:w-[40%] h-full overflow-y-auto border-r border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Cost Calculator</h1>

        {/* SECTION A */}
        <details open className="mb-4 bg-slate-50 border border-slate-200 rounded-lg group">
          <summary className="font-semibold p-4 cursor-pointer flex justify-between items-center text-slate-800">
            Staff rates
          </summary>
          <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PI hourly salary ($)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.pi_hourly_salary} onChange={e => setRates({...rates, pi_hourly_salary: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">CRC hourly salary ($)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.crc_hourly_salary} onChange={e => setRates({...rates, crc_hourly_salary: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">RN hourly salary ($)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.rn_hourly_salary} onChange={e => setRates({...rates, rn_hourly_salary: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Benefits burden (%)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.benefits_pct} onChange={e => setRates({...rates, benefits_pct: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Overhead / indirect (%)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.overhead_pct} onChange={e => setRates({...rates, overhead_pct: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Margin (%)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.margin_pct} onChange={e => setRates({...rates, margin_pct: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Billable time — CRC (%)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.billable_time_pct} onChange={e => setRates({...rates, billable_time_pct: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Annual inflation (%)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={rates.inflation_pct} onChange={e => setRates({...rates, inflation_pct: Number(e.target.value)})} />
            </div>
          </div>
        </details>

        {/* SECTION B */}
        <details open className="mb-4 bg-slate-50 border border-slate-200 rounded-lg">
          <summary className="font-semibold p-4 cursor-pointer text-slate-800">Study parameters</summary>
          <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Total protocol visits</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.total_visits} onChange={e => setStudy({...study, total_visits: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target patients</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.total_patients} onChange={e => setStudy({...study, total_patients: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Study duration (years)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.study_years} onChange={e => setStudy({...study, study_years: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expected amendments</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.expected_amendments} onChange={e => setStudy({...study, expected_amendments: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expected screen failures</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.expected_screen_failures} onChange={e => setStudy({...study, expected_screen_failures: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Expected CRA changes</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={study.expected_cra_changes} onChange={e => setStudy({...study, expected_cra_changes: Number(e.target.value)})} />
            </div>
            <div className="col-span-2 mt-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={study.cta_available} onChange={e => setStudy({...study, cta_available: e.target.checked})} className="rounded border-slate-300" />
                <span>Signed CTA in hand</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">Required for confirmed financial certainty</p>
            </div>
          </div>
        </details>

        {/* SECTION C */}
        <details className="mb-4 bg-slate-50 border border-slate-200 rounded-lg">
          <summary className="font-semibold p-4 cursor-pointer text-slate-800">Visit model</summary>
          <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PI hours per visit</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={visitModel.pi_hrs} onChange={e => setVisitModel({...visitModel, pi_hrs: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">CRC hours per visit</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={visitModel.crc_hrs} onChange={e => setVisitModel({...visitModel, crc_hrs: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">RN hours per visit</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={visitModel.rn_hrs} onChange={e => setVisitModel({...visitModel, rn_hrs: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Room / facility fee ($)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={visitModel.room_fee} onChange={e => setVisitModel({...visitModel, room_fee: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Supplies per visit ($)</label>
              <input type="number" className="w-full border rounded p-2 text-sm" value={visitModel.supply_cost} onChange={e => setVisitModel({...visitModel, supply_cost: Number(e.target.value)})} />
            </div>
          </div>
        </details>

        {/* SECTION D */}
        <details className="mb-6 bg-slate-50 border border-slate-200 rounded-lg">
          <summary className="font-semibold p-4 cursor-pointer text-slate-800">Startup hours</summary>
          <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200 mt-2">
            {[
              {l: 'IRB prep', v: startupHours.irb_hrs, k: 'irb_hrs'},
              {l: 'Protocol review — PI', v: startupHours.proto_pi_hrs, k: 'proto_pi_hrs'},
              {l: 'Protocol review — CRC', v: startupHours.proto_crc_hrs, k: 'proto_crc_hrs'},
              {l: 'Pharmacy setup', v: startupHours.pharmacy_hrs, k: 'pharmacy_hrs'},
              {l: 'Lab setup', v: startupHours.lab_hrs, k: 'lab_hrs'},
              {l: 'Source doc dev', v: startupHours.docs_hrs, k: 'docs_hrs'},
              {l: 'Vendor integrations (#)', v: startupHours.vendor_count, k: 'vendor_count'},
              {l: 'Hours per vendor', v: startupHours.vendor_hrs_each, k: 'vendor_hrs_each'},
              {l: 'Billing coverage analysis', v: startupHours.bca_hrs, k: 'bca_hrs'},
              {l: 'Mock subject QA', v: startupHours.mock_hrs, k: 'mock_hrs'},
              {l: 'Duplicate GCP training', v: startupHours.gcp_hrs, k: 'gcp_hrs'}
            ].map(item => (
              <div key={item.k}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{item.l}</label>
                <input type="number" className="w-full border rounded p-2 text-sm" value={item.v} onChange={e => setStartupHours({...startupHours, [item.k]: Number(e.target.value)})} />
              </div>
            ))}
          </div>
        </details>

        {errorMsg && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-md text-sm flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </span>
            <button
              type="button"
              onClick={computeChargemaster}
              className="text-xs font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <button
          onClick={computeChargemaster}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Calculating..." : errorMsg ? "Retry calculation" : "Calculate my costs"}
        </button>
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-full md:w-[60%] h-full overflow-y-auto p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Negotiation Advisor</h2>

        {!chargemaster ? (
          <div className="p-6 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-center flex flex-col items-center justify-center h-[200px]">
            <FileText className="w-10 h-10 mb-3 text-slate-400" />
            <p className="font-medium">Complete the cost calculator to unlock your negotiation position.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* 3a SUMMARY STRIP */}
            {certainty === "REQUIRES_CTA" && (
              <div className="p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> ⚠ Check Signed CTA in hand to confirm these amounts.
              </div>
            )}
            {certainty === "REQUIRES_CLINIQ" && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> ⚠ Missing rate inputs — amounts shown as estimated only.
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-1">Min budget required</p>
                <p className="text-lg font-bold text-slate-900">{formatAmount(chargemaster.study.total_minimum_budget)}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-1">Per patient cost</p>
                <p className="text-lg font-bold text-slate-900">{formatAmount(chargemaster.study.cost_per_patient)}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-1">Your ask (opening)</p>
                <p className="text-lg font-bold text-slate-900">{formatAmount(chargemaster.study.ask_price)}</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-1">Walk-away floor</p>
                <p className="text-lg font-bold text-slate-900">{formatAmount(chargemaster.study.batna_floor)}</p>
              </div>
            </div>

            {/* 3b STARTUP FEES & 3c PER-EVENT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-medium text-sm text-slate-800">
                  Startup Fees (Non-refundable)
                </div>
                <div className="p-4 text-sm space-y-2">
                  <div className="flex justify-between"><span>IRB/regulatory prep</span> <span>{formatAmount(chargemaster.startup.irb_prep)}</span></div>
                  <div className="flex justify-between"><span>Protocol review (PI + CRC)</span> <span>{formatAmount(chargemaster.startup.protocol_review)}</span></div>
                  <div className="flex justify-between"><span>Pharmacy setup</span> <span>{formatAmount(chargemaster.startup.pharmacy_setup)}</span></div>
                  <div className="flex justify-between"><span>Lab setup</span> <span>{formatAmount(chargemaster.startup.lab_setup)}</span></div>
                  <div className="flex justify-between"><span>Source document dev</span> <span>{formatAmount(chargemaster.startup.source_doc_dev)}</span></div>
                  <div className="flex justify-between"><span>Vendor/tech integrations</span> <span>{formatAmount(chargemaster.startup.vendor_integrations)}</span></div>
                  <div className="flex justify-between"><span>Billing coverage analysis</span> <span>{formatAmount(chargemaster.startup.billing_coverage_analysis)}</span></div>
                  <div className="flex justify-between"><span>Mock subject QA</span> <span>{formatAmount(chargemaster.startup.mock_subject_qa)}</span></div>
                  <div className="flex justify-between"><span>Duplicate GCP training</span> <span>{formatAmount(chargemaster.startup.duplicate_gcp_training)}</span></div>
                  <div className="flex justify-between font-bold pt-2 border-t mt-2"><span>TOTAL</span> <span>{formatAmount(chargemaster.startup.total)}</span></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-medium text-sm text-slate-800">
                  Per-Event Invoiceable Rates
                </div>
                <div className="p-4 text-sm space-y-2">
                  <div className="flex justify-between"><span>Standard visit cost</span> <span>{formatAmount(chargemaster.events.visit_cost)}</span></div>
                  <div className="flex justify-between"><span>Amendment fee</span> <span>{formatAmount(chargemaster.events.amendment_fee)}</span></div>
                  <div className="flex justify-between"><span>Re-consent per patient</span> <span>{formatAmount(chargemaster.events.reconsent_per_patient)}</span></div>
                  <div className="flex justify-between"><span>Change of monitor fee</span> <span>{formatAmount(chargemaster.events.cra_change_fee)}</span></div>
                  <div className="flex justify-between"><span>SAE review fee</span> <span>{formatAmount(chargemaster.events.sae_review_fee)}</span></div>
                  <div className="flex justify-between"><span>Remote file management/month</span> <span>{formatAmount(chargemaster.events.remote_file_monthly)}</span></div>
                </div>
              </div>
            </div>

            {/* 3d SCENARIO ADVISOR */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Scenario Advisor</h3>
              <select
                className="w-full border border-slate-300 rounded p-2 mb-4 text-sm"
                value={selectedScenarioId}
                disabled={!chargemaster || scenarioLoading}
                onChange={e => fetchScenarioResponse(e.target.value)}
              >
                <option value="">-- Select a negotiation scenario --</option>
                {NEGOTIATION_SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>

              {!chargemaster && (
                <p className="mb-4 text-sm text-slate-500">
                  Complete the cost calculator to unlock your negotiation position.
                </p>
              )}

              {scenarioLoading && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Calculating scenario response...
                </div>
              )}

              {scenarioError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>{scenarioError}</p>
                  </div>
                </div>
              )}

              {scenarioResponse && (
                <div className="space-y-4">
                  {scenarioResponse.certainty === 'REQUIRES_CTA' && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>Check the signed CTA to confirm these amounts.</p>
                      </div>
                    </div>
                  )}
                  {scenarioResponse.certainty === 'REQUIRES_CLINIQ' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>ClinIQ rate inputs are still missing. Scenario guidance is blocked.</p>
                      </div>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium mb-3">
                      Certainty: {scenarioResponse.certainty}
                    </span>
                    <div className="mb-3">
                      <strong className="block text-slate-700">What&apos;s happening:</strong>
                      <p className="text-slate-600">{scenarioResponse.cro_tactic}</p>
                    </div>
                    <div className="mb-3">
                      <strong className="block text-slate-700">Your response:</strong>
                      <p className="text-slate-600">{scenarioResponse.site_response}</p>
                    </div>
                    <div className="mb-3">
                      <strong className="block text-slate-700">What to say:</strong>
                      <div className="bg-blue-50 p-3 rounded border border-blue-100 text-blue-900 mt-1">
                        {scenarioResponse.script}
                      </div>
                    </div>
                    <div>
                      <strong className="block text-slate-700">If they push back:</strong>
                      <p className="text-slate-600">{scenarioResponse.fallback}</p>
                    </div>
                  </div>
                </div>
              )}

              {!scenarioResponse && !scenarioLoading && chargemaster && (
                <p className="text-xs text-slate-500">
                  Select a supported scenario to generate the recommendation from the negotiation engine.
                </p>
              )}
            </div>

            {/* 3e CHARGEMASTER SUMMARY BUTTON */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <button
                onClick={generateSummary}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-sm font-medium mb-4"
              >
                Generate sponsor packet text
              </button>

              {summaryText && (
                <textarea
                  readOnly
                  className="w-full h-64 font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded"
                  value={summaryText}
                />
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
