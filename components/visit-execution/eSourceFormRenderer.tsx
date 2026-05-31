"use client";

import React, { useState, useEffect } from "react";
import { SourceFieldBlueprint } from "../../lib/source-studio/source-studio-types";

interface Props {
  fields: SourceFieldBlueprint[];
  values: Record<string, string | number | boolean | null>;
  onFieldChange: (fieldId: string, newValue: string | number | boolean | null) => void;
  readOnly?: boolean;
}

export function ESourceFormRenderer({ fields, values, onFieldChange, readOnly = false }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: SourceFieldBlueprint, value: string | number | boolean | null) => {
    if (field.required && (value === undefined || value === null || value === "")) {
      return "This field is required.";
    }
    if (field.type === "NUMBER" && value !== "" && isNaN(Number(value))) {
      return "Must be a valid number.";
    }
    return null;
  };

  const handleChange = (field: SourceFieldBlueprint, val: string | number | boolean | null) => {
    const errorMsg = validateField(field, val);
    setErrors(prev => ({ ...prev, [field.id]: errorMsg || "" }));
    onFieldChange(field.id, val);
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
      {fields.map(field => {
        if (field.condition) {
          const depVal = values[field.condition.dependent_field_id];
          let isVisible = false;
          if (depVal !== undefined) {
            switch (field.condition.operator) {
              case "EQUALS": isVisible = (depVal === field.condition.value); break;
              case "NOT_EQUALS": isVisible = (depVal !== field.condition.value); break;
              case "GREATER_THAN": isVisible = (Number(depVal) > Number(field.condition.value)); break;
              case "LESS_THAN": isVisible = (Number(depVal) < Number(field.condition.value)); break;
            }
          }
          if (!isVisible) return null;
        }

        const val = values[field.id] ?? "";
        const inputValue = typeof val === "boolean" ? String(val) : val;
        const error = errors[field.id];
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-800">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.instructions && (
              <p className="text-xs text-gray-500">{field.instructions}</p>
            )}
            
            {field.type === "TEXT" && (
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)} 
                disabled={readOnly}
                className={`border p-2 rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              />
            )}

            {field.type === "NUMBER" && (
              <input 
                type="number" 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)} 
                disabled={readOnly}
                className={`border p-2 rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              />
            )}

            {field.type === "BOOLEAN" && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={val === true || val === "true"} onChange={() => handleChange(field, true)} disabled={readOnly} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={val === false || val === "false"} onChange={() => handleChange(field, false)} disabled={readOnly} /> No
                </label>
              </div>
            )}

            {field.type === "RADIO" && field.options && (
              <div className="flex gap-4 flex-wrap">
                {field.options.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={val === opt} onChange={() => handleChange(field, opt)} disabled={readOnly} /> {opt}
                  </label>
                ))}
              </div>
            )}

            {field.type === "SELECT" && field.options && (
              <select 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)}
                disabled={readOnly}
                className={`border p-2 rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              >
                <option value="">Select...</option>
                {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}

            {field.type === "DATE" && (
              <input 
                type="date" 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)} 
                disabled={readOnly}
                className={`border p-2 rounded text-sm w-48 ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              />
            )}

            {field.type === "TIME" && (
              <input 
                type="time" 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)} 
                disabled={readOnly}
                className={`border p-2 rounded text-sm w-32 ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              />
            )}

            {field.type === "NOTES" && (
              <textarea 
                value={inputValue} 
                onChange={e => handleChange(field, e.target.value)} 
                disabled={readOnly}
                rows={3}
                className={`border p-2 rounded text-sm w-full ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-50`}
              />
            )}

            {field.type === "SIGNATURE" && (
              <div className="border border-dashed border-gray-300 p-4 text-center rounded bg-gray-50 cursor-pointer hover:bg-gray-100 text-sm font-medium text-gray-500">
                {val ? `Signed: ${val}` : "Click to Sign (Placeholder)"}
              </div>
            )}

            {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
          </div>
        );
      })}
    </div>
  );
}
