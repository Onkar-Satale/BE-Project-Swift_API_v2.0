import React, { useEffect } from "react";
import AceEditor from "react-ace";

import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-twilight";

import "./bodyTab.css";
import "./HeadersTab.css"; // Reuse params-table styles

export default function BodyTab({
  bodyType = "none",
  setBodyType,
  body,
  setBody,
  onBodyChange,
  formData = [],
  setFormData,
  urlencoded = [],
  setUrlencoded,
}) {
  const handleTypeChange = (e) => {
    const value = e.target.value;
    if (setBodyType) setBodyType(value);

    if (value === "none" && onBodyChange) {
      onBodyChange(null);
    }
  };

  const handleRawChange = (newValue) => {
    if (setBody) setBody(newValue);
    if (onBodyChange) onBodyChange(newValue);
  };

  const handleFormatJson = () => {
    try {
      if (!body || !body.trim()) return;
      const parsed = JSON.parse(body);
      const formatted = JSON.stringify(parsed, null, 2);
      if (setBody) setBody(formatted);
      if (onBodyChange) onBodyChange(formatted);
    } catch {}
  };

  // Ensure initial empty row for form-data
  useEffect(() => {
    if (bodyType === "form-data" && (!formData || formData.length === 0)) {
      if (setFormData) setFormData([{ key: "", value: "", description: "" }]);
    }
  }, [bodyType, formData, setFormData]);

  // Ensure initial empty row for urlencoded
  useEffect(() => {
    if (bodyType === "x-www-form-urlencoded" && (!urlencoded || urlencoded.length === 0)) {
      if (setUrlencoded) setUrlencoded([{ key: "", value: "", description: "" }]);
    }
  }, [bodyType, urlencoded, setUrlencoded]);

  // Form Data row change handler
  const handleFormDataChange = (index, field, value) => {
    const updated = [...(formData || [])];
    if (!updated[index]) updated[index] = { key: "", value: "", description: "" };
    updated[index][field] = value;

    // Auto append row if typing in last row
    if (index === updated.length - 1 && (updated[index].key || updated[index].value)) {
      updated.push({ key: "", value: "", description: "" });
    }

    if (setFormData) setFormData(updated);
  };

  const removeFormDataRow = (index) => {
    const updated = [...(formData || [])];
    if (index === updated.length - 1) return;
    updated.splice(index, 1);
    if (updated.length === 0) {
      updated.push({ key: "", value: "", description: "" });
    }
    if (setFormData) setFormData(updated);
  };

  // Urlencoded row change handler
  const handleUrlencodedChange = (index, field, value) => {
    const updated = [...(urlencoded || [])];
    if (!updated[index]) updated[index] = { key: "", value: "", description: "" };
    updated[index][field] = value;

    // Auto append row if typing in last row
    if (index === updated.length - 1 && (updated[index].key || updated[index].value)) {
      updated.push({ key: "", value: "", description: "" });
    }

    if (setUrlencoded) setUrlencoded(updated);
  };

  const removeUrlencodedRow = (index) => {
    const updated = [...(urlencoded || [])];
    if (index === updated.length - 1) return;
    updated.splice(index, 1);
    if (updated.length === 0) {
      updated.push({ key: "", value: "", description: "" });
    }
    if (setUrlencoded) setUrlencoded(updated);
  };

  const currentFormData = formData && formData.length > 0 ? formData : [{ key: "", value: "", description: "" }];
  const currentUrlencoded = urlencoded && urlencoded.length > 0 ? urlencoded : [{ key: "", value: "", description: "" }];

  return (
    <div className="body-tab">
      <div className="body-options">
        {["none", "raw", "form-data", "x-www-form-urlencoded"].map((option) => (
          <label key={option} className="body-option">
            <input
              type="radio"
              name="body-option"
              value={option}
              checked={bodyType === option}
              onChange={handleTypeChange}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>

      {bodyType === "none" && (
        <div className="no-body-hint">
          This request will be sent without a body. Use this for GET/DELETE requests or endpoints that do not require payload data.
        </div>
      )}

      {bodyType === "raw" && (
        <div className="json-editor">
          <div className="raw-toolbar">
            <span className="raw-badge">JSON</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="format-json-btn"
                onClick={handleFormatJson}
                title="Format and prettify JSON"
              >
                ✨ Format JSON
              </button>
              <button
                type="button"
                className="clear-body-btn"
                onClick={() => handleRawChange("")}
                title="Clear editor"
              >
                Clear
              </button>
            </div>
          </div>
          <AceEditor
            mode="json"
            theme="twilight"
            value={body || ""}
            onChange={handleRawChange}
            name="json-editor"
            editorProps={{ $blockScrolling: true }}
            fontSize={14}
            width="100%"
            height="100%"
            onLoad={(editor) => editor.resize()}
            setOptions={{
              useWorker: false,
              showLineNumbers: true,
              tabSize: 2,
            }}
          />
        </div>
      )}

      {bodyType === "form-data" && (
        <div className="table-body-editor">
          <table className="params-table">
            <thead>
              <tr>
                <th style={{ width: "35%" }}>Key</th>
                <th style={{ width: "35%" }}>Value</th>
                <th style={{ width: "25%" }}>Description</th>
                <th style={{ width: "5%" }}></th>
              </tr>
            </thead>
            <tbody>
              {currentFormData.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) => handleFormDataChange(idx, "key", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => handleFormDataChange(idx, "value", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Description"
                      value={row.description || ""}
                      onChange={(e) => handleFormDataChange(idx, "description", e.target.value)}
                    />
                  </td>
                  <td>
                    {idx !== currentFormData.length - 1 && (
                      <button
                        className="remove-btn"
                        onClick={() => removeFormDataRow(idx)}
                        title="Delete parameter"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="add-param-row-btn"
            onClick={() => {
              const updated = [...currentFormData, { key: "", value: "", description: "" }];
              if (setFormData) setFormData(updated);
            }}
          >
            + Add Form-Data Field
          </button>
        </div>
      )}

      {bodyType === "x-www-form-urlencoded" && (
        <div className="table-body-editor">
          <table className="params-table">
            <thead>
              <tr>
                <th style={{ width: "35%" }}>Key</th>
                <th style={{ width: "35%" }}>Value</th>
                <th style={{ width: "25%" }}>Description</th>
                <th style={{ width: "5%" }}></th>
              </tr>
            </thead>
            <tbody>
              {currentUrlencoded.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      placeholder="Key"
                      value={row.key}
                      onChange={(e) => handleUrlencodedChange(idx, "key", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => handleUrlencodedChange(idx, "value", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Description"
                      value={row.description || ""}
                      onChange={(e) => handleUrlencodedChange(idx, "description", e.target.value)}
                    />
                  </td>
                  <td>
                    {idx !== currentUrlencoded.length - 1 && (
                      <button
                        className="remove-btn"
                        onClick={() => removeUrlencodedRow(idx)}
                        title="Delete parameter"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="add-param-row-btn"
            onClick={() => {
              const updated = [...currentUrlencoded, { key: "", value: "", description: "" }];
              if (setUrlencoded) setUrlencoded(updated);
            }}
          >
            + Add URL-Encoded Field
          </button>
        </div>
      )}
    </div>
  );
}
