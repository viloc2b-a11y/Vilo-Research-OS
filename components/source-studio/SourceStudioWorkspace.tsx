"use client";

import React, { useState } from "react";
import { SourceFormBlueprint, SourceFieldBlueprint, SourceProcedureBlueprint } from "../../lib/source-studio/source-studio-types";
import { saveDraftBlueprint, publishBlueprint } from "../../lib/source-studio/source-studio-actions";
import { v4 as uuidv4 } from "uuid";

interface Props {
  studyId: string;
  initialForms: SourceFormBlueprint[];
}

export function SourceStudioWorkspace({ studyId, initialForms }: Props) {
  const [forms, setForms] = useState<SourceFormBlueprint[]>(initialForms);
  const [activeFormId, setActiveFormId] = useState<string | null>(initialForms[0]?.id || null);
  const [isSaving, setIsSaving] = useState(false);

  const activeForm = forms.find(f => f.id === activeFormId);

  const handleUpdateForm = (updatedForm: SourceFormBlueprint) => {
    setForms(forms.map(f => f.id === updatedForm.id ? updatedForm : f));
  };

  const handleSaveDraft = async () => {
    if (!activeForm) return;
    setIsSaving(true);
    await saveDraftBlueprint(studyId, activeForm);
    setIsSaving(false);
    alert("Draft saved successfully to Supabase.");
  };

  const handlePublish = async () => {
    if (!activeForm) return;
    setIsSaving(true);
    const res = await publishBlueprint(studyId, activeForm.id);
    if (res.success) {
      handleUpdateForm({ ...activeForm, status: "PUBLISHED", version: res.version || activeForm.version });
      alert("Source successfully published. Locked for Execution.");
    }
    setIsSaving(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Form Navigator */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Form Navigator</h2>
        {forms.map(form => (
          <button 
            key={form.id} 
            onClick={() => setActiveFormId(form.id)}
            className={`text-left px-3 py-2 rounded text-sm ${activeFormId === form.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
          >
            {form.name}
            {form.status === "PUBLISHED" && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 rounded">PUB</span>}
          </button>
        ))}
      </div>

      {/* Main Form Editor */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeForm ? (
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{activeForm.name}</h1>
                <p className="text-sm text-gray-500">Version {activeForm.version} • {activeForm.status}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleSaveDraft}
                  disabled={isSaving || activeForm.status === "PUBLISHED"}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Draft"}
                </button>
                <button 
                  onClick={handlePublish}
                  disabled={isSaving || activeForm.status === "PUBLISHED"}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Publish Source
                </button>
              </div>
            </div>

            {/* Field Editor */}
            <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Form Fields</h3>
                <button 
                  disabled={activeForm.status === "PUBLISHED"}
                  onClick={() => {
                    const newField: SourceFieldBlueprint = { id: uuidv4(), label: "New Field", type: "TEXT", required: false, order: activeForm.fields.length };
                    handleUpdateForm({ ...activeForm, fields: [...activeForm.fields, newField] });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  + Add Field
                </button>
              </div>
              <div className="p-4 space-y-4">
                {activeForm.fields.map(field => (
                  <div key={field.id} className="flex gap-4 items-start p-3 border border-gray-100 rounded bg-gray-50">
                    <div className="flex-1 space-y-2">
                      <input 
                        value={field.label}
                        disabled={activeForm.status === "PUBLISHED"}
                        onChange={e => {
                          const updated = activeForm.fields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f);
                          handleUpdateForm({ ...activeForm, fields: updated });
                        }}
                        className="w-full text-sm font-medium bg-transparent border-b border-gray-300 focus:border-blue-500 focus:ring-0 px-0 disabled:opacity-75" 
                      />
                      <input 
                        value={field.instructions || ""}
                        placeholder="Instructions (Optional)"
                        disabled={activeForm.status === "PUBLISHED"}
                        onChange={e => {
                          const updated = activeForm.fields.map(f => f.id === field.id ? { ...f, instructions: e.target.value } : f);
                          handleUpdateForm({ ...activeForm, fields: updated });
                        }}
                        className="w-full text-xs text-gray-500 bg-transparent border-b border-gray-200 focus:border-blue-500 focus:ring-0 px-0 disabled:opacity-75" 
                      />
                    </div>
                    <select 
                      value={field.type}
                      disabled={activeForm.status === "PUBLISHED"}
                      onChange={e => {
                        const updated = activeForm.fields.map(f => f.id === field.id ? { ...f, type: e.target.value as SourceFieldBlueprint["type"] } : f);
                        handleUpdateForm({ ...activeForm, fields: updated });
                      }}
                      className="text-sm border-gray-300 rounded disabled:opacity-75"
                    >
                      <option value="TEXT">Text</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                      <option value="BOOLEAN">Boolean</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        disabled={activeForm.status === "PUBLISHED"}
                        onChange={e => {
                          const updated = activeForm.fields.map(f => f.id === field.id ? { ...f, required: e.target.checked } : f);
                          handleUpdateForm({ ...activeForm, fields: updated });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-75" 
                      />
                      Req
                    </label>
                    <button 
                      disabled={activeForm.status === "PUBLISHED"}
                      onClick={() => {
                        const updated = activeForm.fields.filter(f => f.id !== field.id);
                        handleUpdateForm({ ...activeForm, fields: updated });
                      }}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            Select a form to edit.
          </div>
        )}
      </div>

      {/* Procedure Editor */}
      {activeForm && (
        <div className="w-72 bg-white border-l border-gray-200 p-4 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-800 tracking-wider flex justify-between">
            Procedures
            <button 
              disabled={activeForm.status === "PUBLISHED"}
              onClick={() => {
                const newProc: SourceProcedureBlueprint = { id: uuidv4(), name: "New Procedure", order: activeForm.procedures.length };
                handleUpdateForm({ ...activeForm, procedures: [...activeForm.procedures, newProc] });
              }}
              className="text-blue-600 text-xs hover:underline disabled:opacity-50"
            >
              + Add
            </button>
          </h2>
          <div className="space-y-2">
            {activeForm.procedures.map(proc => (
              <div key={proc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100 text-sm">
                <input 
                  value={proc.name}
                  disabled={activeForm.status === "PUBLISHED"}
                  onChange={e => {
                    const updated = activeForm.procedures.map(p => p.id === proc.id ? { ...p, name: e.target.value } : p);
                    handleUpdateForm({ ...activeForm, procedures: updated });
                  }}
                  className="bg-transparent border-none focus:ring-0 p-0 text-sm w-full disabled:opacity-75 text-gray-700 font-medium"
                />
                <button 
                  disabled={activeForm.status === "PUBLISHED"}
                  onClick={() => {
                    const updated = activeForm.procedures.filter(p => p.id !== proc.id);
                    handleUpdateForm({ ...activeForm, procedures: updated });
                  }}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
