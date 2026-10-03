import React, { useState, useRef, useEffect } from "react";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-twilight";

import { saveFlowRunResults, createFlow, updateFlow } from "../services/flowService";
import { authenticatedFetch } from "../services/authService";
import { showToast } from "../utils/toast";
import { getCleanSnippet } from "../utils/snippetHelper";
import "./FlowStudioModal.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

// ============================================================================
// 🛠️ HELPER FUNCTIONS (VARIABLE EXTRACTION, INTERPOLATION & NORMALIZATION)
// ============================================================================

// Helper to safely extract nested properties from response data or full response wrapper
export function getValueByPath(obj, path, fullResponse = null) {
  if (obj === null || obj === undefined || !path) return undefined;

  const resolve = (root, pathStr) => {
    if (root === null || root === undefined || typeof pathStr !== "string") return undefined;
    let target = root;
    if (typeof target === "string") {
      try {
        target = JSON.parse(target);
      } catch {}
    }

    // Convert bracket notation [0] or ['key'] or ["key"] into dot notation .0 or .key
    const normalized = pathStr
      .trim()
      .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1')
      .replace(/^\./, '');

    const parts = normalized.split('.').map(p => p.trim()).filter(Boolean);
    let current = target;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "string") {
        try {
          current = JSON.parse(current);
        } catch {}
      }
      current = current[part];
    }
    return current;
  };

  const rawPath = String(path).trim();

  // 1. Try resolving exact path on obj (e.g. responseData)
  let val = resolve(obj, rawPath);
  if (val !== undefined && val !== null) return val;

  // 2. Try candidate stripped paths sequentially (do NOT chain all replacements)
  const candidatePrefixes = [
    /^response\.body\./i,
    /^response\.data\./i,
    /^response\./i,
    /^body\./i,
    /^data\./i,
  ];

  for (const prefix of candidatePrefixes) {
    if (prefix.test(rawPath)) {
      const stripped = rawPath.replace(prefix, '');
      val = resolve(obj, stripped);
      if (val !== undefined && val !== null) return val;
    }
  }

  // 3. Array Wildcard Extraction (*.name or *.url) & Cross-Compatibility Fallbacks:
  const cleanedPath = rawPath.replace(/^response\.(body|data)\./i, '').replace(/^response\./i, '');

  if (Array.isArray(obj)) {
    // 3A. Wildcard array mapping (e.g. *.name or *.url or [*].url)
    if (cleanedPath.startsWith("*.") || cleanedPath.startsWith("[*].")) {
      const propKey = cleanedPath.replace(/^(\*\.|\[\*\]\.)/, "");
      const mapped = obj.map(item => resolve(item, propKey)).filter(v => v !== undefined && v !== null);
      if (mapped.length > 0) return mapped;
    }

    // 3B. If obj is an Array and user didn't specify array index
    if (obj.length > 0) {
      const arrayItemVal = resolve(obj[0], cleanedPath) || resolve(obj[0], rawPath);
      if (arrayItemVal !== undefined && arrayItemVal !== null) return arrayItemVal;
    }
  }

  // 3C. If obj is a single Object and user specified array index
  if (typeof obj === "object" && !Array.isArray(obj)) {
    const strippedIndex = cleanedPath.replace(/^0\./, '').replace(/^\[0\]\./, '');
    if (strippedIndex !== cleanedPath) {
      const objVal = resolve(obj, strippedIndex);
      if (objVal !== undefined && objVal !== null) return objVal;
    }
  }

  // 4. Fallback: Try resolving on fullResponse object if available
  if (fullResponse && typeof fullResponse === "object") {
    val = resolve(fullResponse, rawPath);
    if (val !== undefined && val !== null) return val;

    val = resolve(fullResponse, cleanedPath);
    if (val !== undefined && val !== null) return val;

    if (fullResponse.body) {
      val = resolve(fullResponse.body, cleanedPath) || resolve(fullResponse.body, rawPath);
      if (val !== undefined && val !== null) return val;
      if (Array.isArray(fullResponse.body) && fullResponse.body.length > 0) {
        val = resolve(fullResponse.body[0], cleanedPath);
        if (val !== undefined && val !== null) return val;
      }
    }
    if (fullResponse.data) {
      val = resolve(fullResponse.data, cleanedPath) || resolve(fullResponse.data, rawPath);
      if (val !== undefined && val !== null) return val;
      if (Array.isArray(fullResponse.data) && fullResponse.data.length > 0) {
        val = resolve(fullResponse.data[0], cleanedPath);
        if (val !== undefined && val !== null) return val;
      }
    }
  }

  return undefined;
}

// Helper to interpolate {{varName}} in strings, headers, params, and body
export function interpolateVariables(template, variables) {
  if (!template || !variables || typeof variables !== "object") return template;

  const replaceString = (str) => {
    if (typeof str !== "string") return str;
    return str.replace(/\{\{\s*([a-zA-Z0-9_$.-]+)\s*\}\}/g, (match, rawKey) => {
      const key = rawKey.trim();

      // 0. Built-in dynamic variables ($timestamp, $random, $uuid, $isoDate)
      if (key === "$timestamp" || key === "timestamp") {
        return String(Date.now());
      }
      if (key === "$random" || key === "random") {
        return String(Math.floor(1000 + Math.random() * 9000));
      }
      if (key === "$uuid" || key === "$guid" || key === "uuid") {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      }
      if (key === "$isoDate" || key === "$isoTimestamp") {
        return new Date().toISOString();
      }

      // 1. Direct key match
      if (variables[key] !== undefined && variables[key] !== null) {
        return typeof variables[key] === "object" ? JSON.stringify(variables[key]) : String(variables[key]);
      }

      // 2. Stripped prefix key match (e.g. response.body.token -> token)
      const cleanKey = key
        .replace(/^response\.body\./i, '')
        .replace(/^response\.data\./i, '')
        .replace(/^response\./i, '')
        .replace(/^body\./i, '')
        .replace(/^data\./i, '')
        .replace(/^vars\./i, '')
        .replace(/^variables\./i, '');

      if (variables[cleanKey] !== undefined && variables[cleanKey] !== null) {
        return typeof variables[cleanKey] === "object" ? JSON.stringify(variables[cleanKey]) : String(variables[cleanKey]);
      }

      // 3. Case-insensitive key match fallback
      const lowerKey = key.toLowerCase();
      const lowerCleanKey = cleanKey.toLowerCase();
      const found = Object.entries(variables).find(([k]) => {
        const kLower = k.toLowerCase();
        return kLower === lowerKey || kLower === lowerCleanKey;
      });

      if (found && found[1] !== undefined && found[1] !== null) {
        return typeof found[1] === "object" ? JSON.stringify(found[1]) : String(found[1]);
      }

      return match; // Return unchanged if variable is not found in pool
    });
  };

  if (typeof template === "string") {
    return replaceString(template);
  }

  if (typeof template === "object") {
    try {
      const stringified = JSON.stringify(template);
      const replaced = replaceString(stringified);
      return JSON.parse(replaced);
    } catch {
      return template;
    }
  }

  return template;
}

// Helper to render templates with {{varName}} highlighted in green (if resolved) or red (if unresolved)
export function renderHighlightedTemplate(template, variables = {}) {
  if (!template || typeof template !== "string") return template;

  const parts = template.split(/(\{\{\s*[a-zA-Z0-9_.-]+\s*\}\})/g);
  if (parts.length <= 1) return template;

  return parts.map((part, idx) => {
    const match = part.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
    if (!match) return <span key={idx}>{part}</span>;

    const rawKey = match[1].trim();
    const cleanKey = rawKey
      .replace(/^response\.body\./i, '')
      .replace(/^response\.data\./i, '')
      .replace(/^response\./i, '')
      .replace(/^body\./i, '')
      .replace(/^data\./i, '')
      .replace(/^vars\./i, '')
      .replace(/^variables\./i, '');

    const resolvedVal = variables[rawKey] !== undefined ? variables[rawKey] : variables[cleanKey];
    const isResolved = resolvedVal !== undefined && resolvedVal !== null;

    if (isResolved) {
      const displayVal = typeof resolvedVal === "object" ? JSON.stringify(resolvedVal) : String(resolvedVal);
      return (
        <span
          key={idx}
          className="flow-var-tag resolved"
          title={`Resolved: ${displayVal}`}
        >
          {`{{${rawKey}}}`}
          <span className="flow-var-preview">{displayVal.length > 20 ? `${displayVal.slice(0, 18)}…` : displayVal}</span>
        </span>
      );
    }

    return (
      <span
        key={idx}
        className="flow-var-tag unresolved"
        title="Unresolved: Variable not yet in variable pool"
      >
        {`{{${rawKey}}}`}
        <span className="flow-var-preview unres">unresolved</span>
      </span>
    );
  });
}

// Helper to normalize step objects into rich editor format
export function normalizeStep(step, idx = 0) {
  // Normalize params array
  let paramsArr = [{ key: "", value: "", description: "" }];
  if (Array.isArray(step.params) && step.params.length > 0) {
    paramsArr = step.params.map(p => ({
      key: p.key || "",
      value: p.value || "",
      description: p.description || ""
    }));
    if (paramsArr.every(p => p.key.trim() !== "" || p.value.trim() !== "")) {
      paramsArr.push({ key: "", value: "", description: "" });
    }
  } else if (step.params && typeof step.params === "object") {
    paramsArr = Object.entries(step.params).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      description: ""
    }));
    paramsArr.push({ key: "", value: "", description: "" });
  }

  // Normalize headers array
  let headersArr = [{ key: "", value: "", description: "" }];
  if (Array.isArray(step.headers) && step.headers.length > 0) {
    headersArr = step.headers.map(h => ({
      key: h.key || "",
      value: h.value || "",
      description: h.description || ""
    }));
    if (headersArr.every(h => h.key.trim() !== "" || h.value.trim() !== "")) {
      headersArr.push({ key: "", value: "", description: "" });
    }
  } else if (step.headers && typeof step.headers === "object") {
    headersArr = Object.entries(step.headers).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      description: ""
    }));
    headersArr.push({ key: "", value: "", description: "" });
  }

  // Normalize body & bodyType
  let bodyContent = "";
  let bodyType = step.bodyType || "none";
  if (step.body !== null && step.body !== undefined) {
    bodyContent = typeof step.body === "object" ? JSON.stringify(step.body, null, 2) : String(step.body);
    if (!step.bodyType && bodyContent.trim()) {
      bodyType = "raw";
    }
  }

  // Normalize auth
  const authObj = {
    type: step.auth?.type || "none",
    token: step.auth?.token || "",
    username: step.auth?.username || "",
    password: step.auth?.password || ""
  };

  // Normalize settings
  const settingsObj = {
    expectedStatus: step.settings?.expectedStatus || step.expectedStatus || 200,
    timeout: step.settings?.timeout || 15000,
    description: step.settings?.description || ""
  };

  return {
    stepId: step.stepId || `step_${Date.now()}_${idx}`,
    name: step.name || `Step ${idx + 1}`,
    method: (step.method || "GET").toUpperCase(),
    url: step.url || "https://jsonplaceholder.typicode.com/posts",
    params: paramsArr,
    headers: headersArr,
    body: bodyContent,
    bodyType,
    auth: authObj,
    settings: settingsObj,
    extractVariables: Array.isArray(step.extractVariables) ? step.extractVariables : [],
    expectedStatus: settingsObj.expectedStatus,
    activeStepTab: step.activeStepTab || (["POST", "PUT", "PATCH"].includes((step.method || "GET").toUpperCase()) ? "Body" : "Params"),
    collapsed: step.collapsed || false
  };
}

// Convert table array into clean key-value object
function convertTableToObject(arr) {
  if (!Array.isArray(arr)) return {};
  const obj = {};
  arr.forEach(item => {
    if (item && item.key && item.key.trim() !== "") {
      obj[item.key.trim()] = item.value !== undefined ? String(item.value).trim() : "";
    }
  });
  return obj;
}

// ============================================================================
// 🚀 MAIN FLOW STUDIO COMPONENT
// ============================================================================

export default function FlowStudioModal({ flow, initialMode = "builder", onClose, onSaved }) {
  const [currentFlow, setCurrentFlow] = useState(flow || null);
  const [activeTab, setActiveTab] = useState(initialMode); // "builder" | "runner"
  const [name, setName] = useState(flow?.name || "New API Pipeline Flow");
  const [description, setDescription] = useState(flow?.description || "");
  const [steps, setSteps] = useState(() => {
    if (Array.isArray(flow?.steps) && flow.steps.length > 0) {
      return flow.steps.map((s, idx) => normalizeStep(s, idx));
    }
    return [
      normalizeStep({
        stepId: "step_1",
        name: "Login / Authenticate",
        method: "POST",
        url: "http://localhost:5000/api/auth/login",
        bodyType: "raw",
        body: JSON.stringify({ email: "test@example.com", password: "Password123" }, null, 2),
        extractVariables: [{ varName: "authToken", jsonPath: "token" }]
      }, 0)
    ];
  });

  // Runner state
  const [running, setRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [stepResults, setStepResults] = useState([]);
  const [runtimeVars, setRuntimeVars] = useState(flow?.initialVariables || {});
  const [pausedForHealing, setPausedForHealing] = useState(null); // { stepIdx, diagnosis, step, ... }
  const [healedCount, setHealedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState({});
  const [expandedExtractedVars, setExpandedExtractedVars] = useState({});

  const toggleResponseView = (idx) => {
    setExpandedResponses(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleExtractedVar = (key) => {
    setExpandedExtractedVars(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderExtractedVariableViewer = (varKey, varVal, prefixId = "") => {
    const uniqueKey = `${prefixId}_${varKey}`;
    const isExpanded = !!expandedExtractedVars[uniqueKey];
    const isArray = Array.isArray(varVal);
    const isObj = !isArray && varVal !== null && typeof varVal === "object";
    const isLongString = typeof varVal === "string" && varVal.length > 35;
    const rawJson = typeof varVal === "object" ? JSON.stringify(varVal, null, 2) : String(varVal);

    const copyVarKey = (e) => {
      e.stopPropagation();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(`{{${varKey}}}`);
        showToast(`Copied {{${varKey}}} to clipboard!`);
      }
    };

    const copyVarValue = (e) => {
      e.stopPropagation();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(typeof varVal === "object" ? JSON.stringify(varVal, null, 2) : String(varVal));
        showToast(`Copied ${varKey} value to clipboard!`);
      }
    };

    return (
      <div key={uniqueKey} className="extracted-var-container">
        <div
          className="extracted-var-header-row"
          onClick={() => (isArray || isObj || isLongString) && toggleExtractedVar(uniqueKey)}
        >
          <div className="extracted-var-chip-badge" onClick={copyVarKey} title="Click to copy variable token {{...}}">
            <span className="var-chip-name">{`{{${varKey}}}`}</span>
          </div>

          <div className="extracted-var-summary-text">
            {isArray ? (
              <span className="var-type-badge count-badge">{`[${varVal.length} items]`}</span>
            ) : isObj ? (
              <span className="var-type-badge">{`[Object]`}</span>
            ) : (
              <span className="var-summary-val" title={String(varVal)}>
                : {isLongString ? `${String(varVal).slice(0, 32)}…` : String(varVal)}
              </span>
            )}
          </div>

          <div className="extracted-var-actions">
            <button
              type="button"
              className="btn-var-mini"
              onClick={copyVarValue}
              title="Copy full variable value"
            >
              📋 Copy
            </button>
            {(isArray || isObj || isLongString) && (
              <button
                type="button"
                className="btn-var-mini btn-var-expand"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExtractedVar(uniqueKey);
                }}
              >
                {isExpanded ? "▲ Collapse" : "▼ View All"}
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="extracted-var-expanded-box">
            {isArray ? (
              <div className="extracted-var-array-view">
                <div className="array-view-toolbar">
                  <span className="array-count-label">Array Items ({varVal.length}):</span>
                  <button
                    type="button"
                    className="btn-var-mini-action"
                    onClick={copyVarValue}
                  >
                    📋 Copy All as JSON
                  </button>
                </div>
                <div className="extracted-var-items-list">
                  {varVal.length === 0 ? (
                    <div className="extracted-var-empty">(Empty Array)</div>
                  ) : (
                    varVal.map((item, itemIdx) => {
                      const itemStr = typeof item === "object" ? JSON.stringify(item) : String(item);
                      return (
                        <div key={itemIdx} className="extracted-var-item-row">
                          <span className="var-item-idx">{itemIdx + 1}.</span>
                          <span className="var-item-val" title={itemStr}>{itemStr}</span>
                          <button
                            type="button"
                            className="btn-item-copy-mini"
                            title="Copy this item"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(itemStr);
                                showToast(`Copied item #${itemIdx + 1}`);
                              }
                            }}
                          >
                            📋
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="extracted-var-json-view">
                <pre className="extracted-var-pre">{rawJson}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const isCancelledRef = useRef(false);

  // Sync state when flow prop changes
  useEffect(() => {
    if (flow) {
      setCurrentFlow(flow);
      setName(flow.name || "New API Pipeline Flow");
      setDescription(flow.description || "");
      if (Array.isArray(flow.steps) && flow.steps.length > 0) {
        setSteps(flow.steps.map((s, idx) => normalizeStep(s, idx)));
      }
      if (flow.initialVariables) {
        setRuntimeVars(flow.initialVariables);
      }
    }
  }, [flow]);

  // Save Flow definition
  const handleSaveFlow = async () => {
    setSaving(true);
    const flowData = {
      name: name.trim() || "Untitled Flow",
      description: description.trim(),
      steps: steps.map(s => ({
        stepId: s.stepId,
        name: s.name,
        method: s.method,
        url: s.url,
        params: s.params,
        headers: s.headers,
        body: s.body,
        bodyType: s.bodyType,
        auth: s.auth,
        settings: s.settings,
        extractVariables: s.extractVariables,
        expectedStatus: s.settings?.expectedStatus || s.expectedStatus || 200
      })),
      initialVariables: runtimeVars
    };

    let saved = null;
    const targetId = currentFlow?._id || flow?._id;
    if (targetId) {
      saved = await updateFlow(targetId, flowData);
    } else {
      saved = await createFlow(flowData);
    }

    setSaving(false);
    if (saved) {
      setCurrentFlow(saved);
      showToast("💾 Flow saved successfully!");
      if (onSaved) onSaved(saved);
    } else {
      showToast("⚠️ Could not save flow to server. Saved to local state.");
    }
  };

  // Add Step in Builder
  const handleAddStep = () => {
    const newIdx = steps.length;
    const newStep = normalizeStep({
      stepId: `step_${Date.now()}`,
      name: `Step ${newIdx + 1}`,
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      params: [{ key: "", value: "", description: "" }],
      headers: [{ key: "", value: "", description: "" }],
      body: "",
      bodyType: "none",
      extractVariables: []
    }, newIdx);

    setSteps(prev => [...prev, newStep]);
  };

  const handleUpdateStep = (idx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleDeleteStep = (idx) => {
    if (steps.length <= 1) {
      showToast("⚠️ A flow requires at least 1 step.");
      return;
    }
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDuplicateStep = (idx) => {
    const target = steps[idx];
    const duplicated = normalizeStep({
      ...JSON.parse(JSON.stringify(target)),
      stepId: `step_${Date.now()}`,
      name: `${target.name} (Copy)`
    }, steps.length);
    setSteps(prev => [...prev, duplicated]);
    showToast(`📋 Duplicated ${target.name}`);
  };

  const handleToggleCollapse = (idx) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], collapsed: !copy[idx].collapsed };
      return copy;
    });
  };

  // -------------------------------------------------------------
  // 📋 Step Params Handlers (with URL sync)
  // -------------------------------------------------------------
  const handleParamChange = (stepIdx, pIdx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      const params = [...(step.params || [])];
      params[pIdx] = { ...params[pIdx], [field]: val };

      // Ensure last empty row exists
      const filled = params.filter(p => p.key.trim() !== "" || p.value.trim() !== "" || p.description.trim() !== "");
      step.params = [...filled, { key: "", value: "", description: "" }];

      // Sync URL query string
      const baseUrl = (step.url || "").split("?")[0].trim();
      const valid = step.params.filter(p => p.key && p.key.trim() !== "");
      if (valid.length > 0) {
        const qs = valid.map(p => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value ? p.value.trim() : "")}`).join("&");
        step.url = `${baseUrl}?${qs}`;
      } else {
        step.url = baseUrl;
      }

      copy[stepIdx] = step;
      return copy;
    });
  };

  const handleRemoveParam = (stepIdx, pIdx) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      const params = [...(step.params || [])];
      params.splice(pIdx, 1);
      if (params.length === 0) params.push({ key: "", value: "", description: "" });
      step.params = params;

      const baseUrl = (step.url || "").split("?")[0].trim();
      const valid = step.params.filter(p => p.key && p.key.trim() !== "");
      step.url = valid.length > 0 ? `${baseUrl}?${valid.map(p => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value ? p.value.trim() : "")}`).join("&")}` : baseUrl;

      copy[stepIdx] = step;
      return copy;
    });
  };

  const handleClearAllParams = (stepIdx) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      step.params = [{ key: "", value: "", description: "" }];
      step.url = (step.url || "").split("?")[0].trim();
      copy[stepIdx] = step;
      return copy;
    });
  };

  // -------------------------------------------------------------
  // 🏷️ Step Headers Handlers
  // -------------------------------------------------------------
  const handleHeaderChange = (stepIdx, hIdx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      const headers = [...(step.headers || [])];
      headers[hIdx] = { ...headers[hIdx], [field]: val };

      const filled = headers.filter(h => h.key.trim() !== "" || h.value.trim() !== "" || (h.description && h.description.trim() !== ""));
      step.headers = [...filled, { key: "", value: "", description: "" }];
      copy[stepIdx] = step;
      return copy;
    });
  };

  const handleRemoveHeader = (stepIdx, hIdx) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      const headers = [...(step.headers || [])];
      headers.splice(hIdx, 1);
      if (headers.length === 0) headers.push({ key: "", value: "", description: "" });
      step.headers = headers;
      copy[stepIdx] = step;
      return copy;
    });
  };

  // -------------------------------------------------------------
  // 📦 Step Body & Auth Handlers
  // -------------------------------------------------------------
  const handleBodyChange = (stepIdx, bodyVal) => {
    handleUpdateStep(stepIdx, "body", bodyVal);
  };

  const handleBodyTypeChange = (stepIdx, type) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[stepIdx] = { ...copy[stepIdx], bodyType: type };
      return copy;
    });
  };

  const handleFormatJsonBody = (stepIdx) => {
    const raw = steps[stepIdx].body;
    try {
      const parsed = JSON.parse(raw);
      handleUpdateStep(stepIdx, "body", JSON.stringify(parsed, null, 2));
      showToast("✨ JSON Formatted successfully!");
    } catch (e) {
      showToast("⚠️ Invalid JSON syntax. Could not format.");
    }
  };

  const handleAuthChange = (stepIdx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      step.auth = { ...(step.auth || { type: "none" }), [field]: val };
      copy[stepIdx] = step;
      return copy;
    });
  };

  // -------------------------------------------------------------
  // ⚙️ Step Settings Handlers
  // -------------------------------------------------------------
  const handleSettingsChange = (stepIdx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      const step = { ...copy[stepIdx] };
      step.settings = { ...(step.settings || { expectedStatus: 200 }), [field]: val };
      if (field === "expectedStatus") {
        step.expectedStatus = parseInt(val, 10) || 200;
      }
      copy[stepIdx] = step;
      return copy;
    });
  };

  // -------------------------------------------------------------
  // 📥 Variable Extraction Handlers
  // -------------------------------------------------------------
  const handleAddExtractVar = (stepIdx) => {
    setSteps(prev => {
      const copy = [...prev];
      const existing = copy[stepIdx].extractVariables || [];
      copy[stepIdx] = {
        ...copy[stepIdx],
        extractVariables: [
          ...existing,
          { varName: `var_${existing.length + 1}`, jsonPath: "id", description: "" }
        ]
      };
      return copy;
    });
  };

  const handleUpdateExtractVar = (stepIdx, varIdx, field, val) => {
    setSteps(prev => {
      const copy = [...prev];
      const vars = [...(copy[stepIdx].extractVariables || [])];
      vars[varIdx] = { ...vars[varIdx], [field]: val };
      copy[stepIdx] = { ...copy[stepIdx], extractVariables: vars };
      return copy;
    });
  };

  const handleDeleteExtractVar = (stepIdx, varIdx) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[stepIdx] = {
        ...copy[stepIdx],
        extractVariables: copy[stepIdx].extractVariables.filter((_, i) => i !== varIdx)
      };
      return copy;
    });
  };

  // Helper to gather all variables extracted before a given step index
  const getAvailableVariablesForStep = (stepIdx) => {
    const vars = new Set(Object.keys(runtimeVars || {}));
    for (let i = 0; i < stepIdx; i++) {
      (steps[i].extractVariables || []).forEach(v => {
        if (v.varName && v.varName.trim()) {
          vars.add(v.varName.trim());
        }
      });
    }
    return Array.from(vars);
  };

  // ============================================================================
  // 🚀 SEQUENTIAL FLOW EXECUTION ENGINE
  // ============================================================================

  const startFlowRun = async () => {
    setActiveTab("runner");
    setRunning(true);
    setStepResults([]);
    setCurrentStepIdx(0);
    setPausedForHealing(null);
    setHealedCount(0);
    isCancelledRef.current = false;

    let vars = { ...(flow?.initialVariables || {}) };
    setRuntimeVars(vars);

    await executeFlowFromStep(0, vars, [], 0, steps);
  };

  // Executes flow starting from given step index
  const executeFlowFromStep = async (startIdx, currentVars, currentResults, currentHealed, currentSteps) => {
    let localVars = { ...currentVars };
    let results = [...currentResults];
    let healed = currentHealed;
    let localSteps = [...currentSteps];

    for (let i = startIdx; i < localSteps.length; i++) {
      if (isCancelledRef.current) break;

      setCurrentStepIdx(i);
      const step = localSteps[i];

      // 1. Resolve variable interpolations & sanitize URL
      const rawTemplateUrl = step.url;
      const rawResolvedUrl = interpolateVariables(step.url, localVars);
      let cleanUrl = String(rawResolvedUrl || "").trim();
      while (cleanUrl.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/i)) {
        cleanUrl = cleanUrl.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, "").trim();
      }
      cleanUrl = cleanUrl.replace(/\s+\//g, '/').replace(/\/\s+/g, '/');
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = `https://${cleanUrl}`;
      }
      const resolvedUrl = cleanUrl;

      // 2. Resolve Authorization & Headers
      const resolvedHeaders = {};
      const rawHeadersObj = convertTableToObject(step.headers);
      Object.entries(rawHeadersObj).forEach(([k, v]) => {
        if (k) resolvedHeaders[k] = interpolateVariables(v, localVars);
      });

      // Synthesize Authorization header from Auth settings if configured
      if (step.auth && step.auth.type === "bearer" && step.auth.token) {
        const resolvedToken = interpolateVariables(step.auth.token, localVars);
        resolvedHeaders["Authorization"] = `Bearer ${resolvedToken}`;
      } else if (step.auth && step.auth.type === "basic" && step.auth.username) {
        const resolvedUser = interpolateVariables(step.auth.username, localVars);
        const resolvedPass = interpolateVariables(step.auth.password || "", localVars);
        const encoded = btoa(`${resolvedUser}:${resolvedPass}`);
        resolvedHeaders["Authorization"] = `Basic ${encoded}`;
      }

      if (!resolvedHeaders["Content-Type"] && ["POST", "PUT", "PATCH"].includes(step.method)) {
        resolvedHeaders["Content-Type"] = "application/json";
      }
      if (!resolvedHeaders["User-Agent"]) {
        resolvedHeaders["User-Agent"] = "SwiftAPIClient/2.0";
      }

      // 3. Resolve Query Params
      const resolvedParams = {};
      const rawParamsObj = convertTableToObject(step.params);
      Object.entries(rawParamsObj).forEach(([k, v]) => {
        if (k) resolvedParams[k] = interpolateVariables(v, localVars);
      });

      // 4. Resolve Body
      let resolvedBody = null;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(step.method) && step.body && step.bodyType !== "none") {
        if (typeof step.body === "string" && step.body.trim()) {
          const interpolatedStr = interpolateVariables(step.body, localVars);
          try {
            resolvedBody = JSON.parse(interpolatedStr);
          } catch {
            resolvedBody = interpolatedStr;
          }
        } else if (typeof step.body === "object") {
          resolvedBody = interpolateVariables(step.body, localVars);
        }
      }

      // 🔍 Debug Logging
      console.log(`\n=================== [FlowRunner] STEP ${i + 1}: "${step.name || step.stepId}" ===================`);
      console.log(`[FlowRunner] Method:`, step.method);
      console.log(`[FlowRunner] Template URL:`, rawTemplateUrl);
      console.log(`[FlowRunner] Resolved URL:`, resolvedUrl);
      console.log(`[FlowRunner] Resolved Headers:`, resolvedHeaders);
      console.log(`[FlowRunner] Resolved Body:`, resolvedBody);
      console.log(`[FlowRunner] Variable Pool at Step Start:`, JSON.parse(JSON.stringify(localVars)));

      // 5. Execute Step via Backend Proxy
      const startTime = Date.now();
      let responseStatus = 0;
      let responseData = null;
      let stepPassed = false;
      let errorMsg = null;

      try {
        const res = await authenticatedFetch(`${BACKEND_URL}/api/request`, {
          method: "POST",
          body: JSON.stringify({
            method: (step.method || "GET").toUpperCase(),
            url: resolvedUrl,
            headers: resolvedHeaders,
            body: resolvedBody,
            params: resolvedParams
          })
        });

        const json = await res.json();
        const duration = Date.now() - startTime;
        responseStatus = json.status || res.status;
        
        responseData = json.body !== undefined ? json.body : (json.data !== undefined ? json.data : json);

        const expected = step.settings?.expectedStatus || step.expectedStatus || 200;
        stepPassed = responseStatus === expected || (expected === 200 && responseStatus >= 200 && responseStatus < 300);

        if (!stepPassed) {
          errorMsg = `Status ${responseStatus} did not match expected ${expected}`;
        }

        // 6. If Step Passed -> Extract Variables into localVars
        const extractedThisStep = {};
        if (stepPassed && responseData !== undefined && responseData !== null) {
          (step.extractVariables || []).forEach(vRule => {
            if (vRule.varName && vRule.jsonPath) {
              const val = getValueByPath(responseData, vRule.jsonPath, json);
              if (val !== undefined && val !== null) {
                const cleanKey = vRule.varName.trim();
                extractedThisStep[cleanKey] = val;
                localVars[cleanKey] = val;
              }
            }
          });

          setRuntimeVars({ ...localVars });
        }

        console.log(`[FlowRunner] Step ${i + 1} Status:`, responseStatus);
        console.log(`[FlowRunner] Extracted from Step ${i + 1}:`, extractedThisStep);
        console.log(`[FlowRunner] Updated Variable Pool:`, JSON.parse(JSON.stringify(localVars)));
        console.log(`=================================================================================\n`);

        const stepResultItem = {
          stepId: step.stepId,
          name: step.name,
          method: step.method,
          url: resolvedUrl,
          status: responseStatus,
          duration,
          passed: stepPassed,
          error: errorMsg,
          extracted: extractedThisStep,
          responseBody: responseData,
          healed: false
        };

        results[i] = stepResultItem;
        setStepResults([...results]);

        // 7. Autonomous Failure Pause & RAG Self-Healing Trigger
        if (!stepPassed) {
          setRunning(false);

          let diagnosis = null;
          let retrievedEpisodes = [];
          try {
            const diagRes = await authenticatedFetch(`${BACKEND_URL}/api/ai/failure-assist`, {
              method: "POST",
              body: JSON.stringify({
                method: step.method || "GET",
                url: resolvedUrl,
                status: responseStatus,
                response: responseData || errorMsg,
                headers: resolvedHeaders,
                userId: localStorage.getItem("currentUserId") || "guest",
                previousAttempts: []
              })
            });

            if (diagRes.ok) {
              const diagJson = await diagRes.json();
              diagnosis = diagJson.diagnosis || diagJson;
              retrievedEpisodes = diagJson.retrievedEpisodes || [];
            }
          } catch (dErr) {
            console.error("Failure assist call error in flow runner:", dErr);
          }

          setPausedForHealing({
            stepIdx: i,
            step,
            resolvedUrl,
            status: responseStatus,
            error: errorMsg,
            diagnosis,
            retrievedEpisodes,
            currentVars: localVars,
            results,
            healedCount: healed,
            currentSteps: localSteps
          });
          return; // Pause runner for intervention
        }
      } catch (execErr) {
        console.error("Step execution error:", execErr);
        results[i] = {
          stepId: step.stepId,
          name: step.name,
          method: step.method,
          url: resolvedUrl,
          status: "Network Error",
          duration: Date.now() - startTime,
          passed: false,
          error: execErr.message,
          extracted: {},
          healed: false
        };
        setStepResults([...results]);
        setRunning(false);
        return;
      }
    }

    // Complete flow run successfully
    setRunning(false);
    setCurrentStepIdx(-1);

    const totalPassed = results.every(r => r && r.passed);
    const lastRunSummary = {
      runId: `run_${Date.now()}`,
      timestamp: new Date(),
      passed: totalPassed,
      totalSteps: localSteps.length,
      healedStepsCount: healed,
      duration: results.reduce((acc, r) => acc + (r?.duration || 0), 0),
      stepResults: results
    };

    const flowIdToSave = currentFlow?._id || flow?._id;
    if (flowIdToSave) {
      await saveFlowRunResults(flowIdToSave, lastRunSummary, localSteps);
      if (onSaved) {
        onSaved({ ...(currentFlow || flow), lastRun: lastRunSummary, steps: localSteps });
      }
    }
  };

  // 🔄 Retry Step Execution & Re-resume Runner
  const handleRetryFailedStep = async () => {
    if (!pausedForHealing) return;

    const { stepIdx, currentVars, results, healedCount: curHealed, currentSteps: curSteps } = pausedForHealing;
    setPausedForHealing(null);
    setRunning(true);

    await executeFlowFromStep(stepIdx, currentVars, results, curHealed, curSteps);
  };

  // ✏️ Jump to Builder to Edit Failed Step
  const handleEditStepFromDiagnosis = (stepIdx) => {
    setPausedForHealing(null);
    setRunning(false);
    setActiveTab("builder");
    // Expand the target step for easy editing
    setSteps(prev => prev.map((s, idx) => idx === stepIdx ? { ...s, collapsed: false } : s));
  };

  return (
    <div className="flow-studio-overlay" onClick={onClose}>
      <div className="flow-studio-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flow-studio-header">
          <div className="flow-header-left">
            <span className="flow-header-title">
              🔀 {name || "Flow Studio"}
            </span>
            <span className="flow-badge">
              {steps.length} Steps
            </span>
            {healedCount > 0 && (
              <span className="flow-badge" style={{ background: "rgba(249, 226, 175, 0.2)", color: "#f9e2af" }}>
                🛠️ {healedCount} Healed
              </span>
            )}
          </div>

          <div className="flow-header-actions">
            <button className="studio-run-btn" onClick={startFlowRun} disabled={running}>
              {running ? "⏳ Running..." : "🚀 Run Flow"}
            </button>
            <button className="studio-save-btn" onClick={handleSaveFlow} disabled={saving}>
              {saving ? "Saving..." : "💾 Save Flow"}
            </button>
            <button className="studio-close-btn" onClick={onClose} title="Close Studio">
              ✕
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flow-studio-tabs">
          <button
            className={`studio-tab-btn ${activeTab === "builder" ? "active" : ""}`}
            onClick={() => setActiveTab("builder")}
          >
            🛠️ Flow Builder (Multi-Step Pipeline)
          </button>
          <button
            className={`studio-tab-btn ${activeTab === "runner" ? "active" : ""}`}
            onClick={() => setActiveTab("runner")}
          >
            ⚡ Autonomous Runner & Dynamic Variables
          </button>
        </div>

        {/* Body */}
        <div className="flow-studio-body">
          {activeTab === "builder" ? (
            /* BUILDER MODE */
            <>
              {/* Flow Meta Form */}
              <div className="flow-meta-form">
                <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                  <div className="flow-input-group" style={{ flex: 1 }}>
                    <label>Pipeline Name</label>
                    <input
                      type="text"
                      className="flow-text-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. User Auth -> Trip Itinerary -> Packing List Flow"
                    />
                  </div>
                  <div className="flow-input-group" style={{ flex: 2 }}>
                    <label>Description / Notes</label>
                    <input
                      type="text"
                      className="flow-text-input"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Executes login, extracts token, creates trip itinerary, and queries packing list..."
                    />
                  </div>
                </div>
              </div>

              {/* Steps List */}
              <div className="flow-steps-section">
                <div className="flow-steps-header">
                  <h4>Pipeline Steps ({steps.length})</h4>
                  <button className="add-step-btn" onClick={handleAddStep}>
                    + Add New Step
                  </button>
                </div>

                {steps.map((step, idx) => {
                  const availableVars = getAvailableVariablesForStep(idx);
                  const activeStepTab = step.activeStepTab || "Params";

                  const nonZeroParamsCount = (step.params || []).filter(p => p.key && p.key.trim() !== "").length;
                  const nonZeroHeadersCount = (step.headers || []).filter(h => h.key && h.key.trim() !== "").length;
                  const extractCount = (step.extractVariables || []).length;

                  return (
                    <div key={step.stepId || idx} className={`step-card ${step.collapsed ? "collapsed" : ""}`}>
                      {/* Step Card Top Bar */}
                      <div className="step-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                          <span className="step-number-badge">{idx + 1}</span>
                          <input
                            type="text"
                            className="step-name-input"
                            value={step.name}
                            onChange={(e) => handleUpdateStep(idx, "name", e.target.value)}
                            placeholder={`Step ${idx + 1} Name`}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            className="step-icon-btn"
                            onClick={() => handleDuplicateStep(idx)}
                            title="Duplicate Step"
                          >
                            📋
                          </button>
                          <button
                            className="step-icon-btn"
                            onClick={() => handleToggleCollapse(idx)}
                            title={step.collapsed ? "Expand Step" : "Collapse Step"}
                          >
                            {step.collapsed ? "▼" : "▲"}
                          </button>
                          <button
                            className="step-icon-btn delete"
                            onClick={() => handleDeleteStep(idx)}
                            title="Delete Step"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Method + URL Bar */}
                      <div className="step-row-top">
                        <select
                          className={`step-method-select method-${step.method}`}
                          value={step.method}
                          onChange={(e) => {
                            const newMethod = e.target.value;
                            handleUpdateStep(idx, "method", newMethod);
                            if (["POST", "PUT", "PATCH"].includes(newMethod) && step.bodyType === "none") {
                              handleUpdateStep(idx, "bodyType", "raw");
                              handleUpdateStep(idx, "activeStepTab", "Body");
                            }
                          }}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>

                        <input
                          type="text"
                          className="step-url-input"
                          value={step.url}
                          onChange={(e) => handleUpdateStep(idx, "url", e.target.value)}
                          placeholder="http://localhost:5000/api/trips/{{tripId}}"
                        />
                      </div>

                      {/* Real-time Dynamic Variable Highlighting Preview */}
                      {step.url && step.url.includes("{{") && (
                        <div className="step-url-var-preview">
                          <span style={{ color: "#71717a" }}>Dynamic URL Preview:</span>
                          <span>{renderHighlightedTemplate(step.url, runtimeVars)}</span>
                        </div>
                      )}

                      {!step.collapsed && (
                        <>
                          {/* Step Request Editor Sub-Tabs */}
                          <div className="step-subtabs-nav">
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Params" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Params")}
                            >
                              📋 Params {nonZeroParamsCount > 0 && <span className="subtab-count">{nonZeroParamsCount}</span>}
                            </button>
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Headers" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Headers")}
                            >
                              🏷️ Headers {nonZeroHeadersCount > 0 && <span className="subtab-count">{nonZeroHeadersCount}</span>}
                            </button>
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Body" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Body")}
                            >
                              📦 Body {step.bodyType !== "none" && <span className="subtab-badge-sm">{step.bodyType}</span>}
                            </button>
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Authorization" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Authorization")}
                            >
                              🔐 Authorization {step.auth?.type !== "none" && <span className="subtab-badge-sm">{step.auth.type}</span>}
                            </button>
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Settings" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Settings")}
                            >
                              ⚙️ Settings
                            </button>
                            <button
                              type="button"
                              className={`step-subtab-btn ${activeStepTab === "Extract" ? "active" : ""}`}
                              onClick={() => handleUpdateStep(idx, "activeStepTab", "Extract")}
                            >
                              📥 Extract Var {extractCount > 0 && <span className="subtab-count highlight">{extractCount}</span>}
                            </button>
                          </div>

                          {/* SUBTAB: PARAMS */}
                          {activeStepTab === "Params" && (
                            <div className="step-subtab-content">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                <span style={{ fontSize: "11px", color: "#888" }}>Query Parameters (Synced to URL)</span>
                                {nonZeroParamsCount > 0 && (
                                  <button
                                    type="button"
                                    className="step-clear-btn"
                                    onClick={() => handleClearAllParams(idx)}
                                  >
                                    🧹 Clear Params
                                  </button>
                                )}
                              </div>

                              <table className="step-editor-table">
                                <thead>
                                  <tr>
                                    <th>Key</th>
                                    <th>Value (Supports {`{{var}}`})</th>
                                    <th>Description</th>
                                    <th style={{ width: "30px" }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(step.params || []).map((param, pIdx) => (
                                    <tr key={pIdx}>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="key"
                                          value={param.key}
                                          onChange={(e) => handleParamChange(idx, pIdx, "key", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="value or {{varName}}"
                                          value={param.value}
                                          onChange={(e) => handleParamChange(idx, pIdx, "value", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="description"
                                          value={param.description || ""}
                                          onChange={(e) => handleParamChange(idx, pIdx, "description", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        {pIdx !== (step.params || []).length - 1 && (
                                          <button
                                            type="button"
                                            className="step-row-del-btn"
                                            onClick={() => handleRemoveParam(idx, pIdx)}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* SUBTAB: HEADERS */}
                          {activeStepTab === "Headers" && (
                            <div className="step-subtab-content">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                <span style={{ fontSize: "11px", color: "#888" }}>Custom HTTP Request Headers</span>
                              </div>

                              <table className="step-editor-table">
                                <thead>
                                  <tr>
                                    <th>Header Key</th>
                                    <th>Value (Supports {`{{var}}`})</th>
                                    <th>Description</th>
                                    <th style={{ width: "30px" }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(step.headers || []).map((header, hIdx) => (
                                    <tr key={hIdx}>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="e.g. Content-Type, Authorization"
                                          value={header.key}
                                          onChange={(e) => handleHeaderChange(idx, hIdx, "key", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="e.g. Bearer {{authToken}}"
                                          value={header.value}
                                          onChange={(e) => handleHeaderChange(idx, hIdx, "value", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          type="text"
                                          placeholder="description"
                                          value={header.description || ""}
                                          onChange={(e) => handleHeaderChange(idx, hIdx, "description", e.target.value)}
                                        />
                                      </td>
                                      <td>
                                        {hIdx !== (step.headers || []).length - 1 && (
                                          <button
                                            type="button"
                                            className="step-row-del-btn"
                                            onClick={() => handleRemoveHeader(idx, hIdx)}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* SUBTAB: BODY */}
                          {activeStepTab === "Body" && (
                            <div className="step-subtab-content">
                              <div className="body-mode-selector">
                                {["none", "raw", "form-data", "x-www-form-urlencoded"].map((bOption) => (
                                  <label key={bOption} className="body-radio-label">
                                    <input
                                      type="radio"
                                      name={`step_body_${idx}`}
                                      value={bOption}
                                      checked={step.bodyType === bOption}
                                      onChange={() => handleBodyTypeChange(idx, bOption)}
                                    />
                                    <span>{bOption}</span>
                                  </label>
                                ))}

                                {step.bodyType === "raw" && (
                                  <button
                                    type="button"
                                    className="format-json-btn"
                                    onClick={() => handleFormatJsonBody(idx)}
                                  >
                                    ✨ Format JSON
                                  </button>
                                )}
                              </div>

                              {/* Available variables insertion bar */}
                              {availableVars.length > 0 && step.bodyType === "raw" && (
                                <div className="step-var-quickbar">
                                  <span style={{ fontSize: "10px", color: "#a1a1aa" }}>Insert Variable:</span>
                                  {availableVars.map(vName => (
                                    <button
                                      key={vName}
                                      type="button"
                                      className="insert-var-btn"
                                      onClick={() => {
                                        const append = `{{${vName}}}`;
                                        const cur = step.body || "";
                                        handleBodyChange(idx, cur ? `${cur}\n"${vName}": "${append}"` : `{\n  "${vName}": "${append}"\n}`);
                                      }}
                                    >
                                      + {`{{${vName}}}`}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {step.bodyType === "none" && (
                                <div className="step-empty-body-hint">
                                  This step sends no request body. Suitable for GET or simple DELETE requests.
                                </div>
                              )}

                              {step.bodyType === "raw" && (
                                <div className="step-code-editor-box">
                                  <AceEditor
                                    mode="json"
                                    theme="twilight"
                                    value={step.body || ""}
                                    onChange={(val) => handleBodyChange(idx, val)}
                                    name={`step_editor_${idx}`}
                                    fontSize={12}
                                    width="100%"
                                    height="160px"
                                    setOptions={{
                                      useWorker: false,
                                      showLineNumbers: true,
                                      tabSize: 2
                                    }}
                                  />
                                </div>
                              )}

                              {(step.bodyType === "form-data" || step.bodyType === "x-www-form-urlencoded") && (
                                <div className="step-code-editor-box">
                                  <textarea
                                    className="step-textarea"
                                    value={step.body || ""}
                                    onChange={(e) => handleBodyChange(idx, e.target.value)}
                                    placeholder="key1=value1&key2={{myVar}}"
                                    rows={5}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* SUBTAB: AUTHORIZATION */}
                          {activeStepTab === "Authorization" && (
                            <div className="step-subtab-content">
                              <div className="step-auth-form">
                                <div className="step-auth-row">
                                  <label className="step-auth-label">Auth Type</label>
                                  <select
                                    className="step-auth-select"
                                    value={step.auth?.type || "none"}
                                    onChange={(e) => handleAuthChange(idx, "type", e.target.value)}
                                  >
                                    <option value="none">No Auth</option>
                                    <option value="bearer">Bearer Token</option>
                                    <option value="basic">Basic Auth</option>
                                  </select>
                                </div>

                                {step.auth?.type === "bearer" && (
                                  <div className="step-auth-row">
                                    <label className="step-auth-label">Bearer Token</label>
                                    <input
                                      type="text"
                                      className="step-auth-input"
                                      placeholder="e.g. {{authToken}} or eyJhbGci..."
                                      value={step.auth?.token || ""}
                                      onChange={(e) => handleAuthChange(idx, "token", e.target.value)}
                                    />
                                    {availableVars.length > 0 && (
                                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                                        {availableVars.map(vName => (
                                          <button
                                            key={vName}
                                            type="button"
                                            className="insert-var-btn"
                                            onClick={() => handleAuthChange(idx, "token", `{{${vName}}}`)}
                                          >
                                            Use {`{{${vName}}}`}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {step.auth?.type === "basic" && (
                                  <>
                                    <div className="step-auth-row">
                                      <label className="step-auth-label">Username</label>
                                      <input
                                        type="text"
                                        className="step-auth-input"
                                        placeholder="Username or {{userVar}}"
                                        value={step.auth?.username || ""}
                                        onChange={(e) => handleAuthChange(idx, "username", e.target.value)}
                                      />
                                    </div>
                                    <div className="step-auth-row">
                                      <label className="step-auth-label">Password</label>
                                      <input
                                        type="password"
                                        className="step-auth-input"
                                        placeholder="Password or {{passVar}}"
                                        value={step.auth?.password || ""}
                                        onChange={(e) => handleAuthChange(idx, "password", e.target.value)}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* SUBTAB: SETTINGS */}
                          {activeStepTab === "Settings" && (
                            <div className="step-subtab-content">
                              <div className="step-settings-grid">
                                <div className="step-input-group">
                                  <label>Expected HTTP Status Code</label>
                                  <input
                                    type="number"
                                    className="flow-text-input"
                                    style={{ width: "120px" }}
                                    value={step.settings?.expectedStatus || step.expectedStatus || 200}
                                    onChange={(e) => handleSettingsChange(idx, "expectedStatus", e.target.value)}
                                  />
                                  <span style={{ fontSize: "10.5px", color: "#71717a" }}>
                                    Step passes if response status matches this code (e.g. 200, 201).
                                  </span>
                                </div>

                                <div className="step-input-group">
                                  <label>Request Timeout (ms)</label>
                                  <input
                                    type="number"
                                    className="flow-text-input"
                                    style={{ width: "120px" }}
                                    value={step.settings?.timeout || 15000}
                                    onChange={(e) => handleSettingsChange(idx, "timeout", e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SUBTAB: EXTRACT VARIABLES */}
                          {activeStepTab === "Extract" && (
                            <div className="step-subtab-content">
                              <div className="variables-extraction-box">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span className="var-extract-title">
                                    📥 Extract Response Variables (Passed to downstream steps)
                                  </span>
                                  <button
                                    className="add-step-btn"
                                    style={{ padding: "3px 8px", fontSize: "10.5px" }}
                                    onClick={() => handleAddExtractVar(idx)}
                                  >
                                    + Add Extraction Rule
                                  </button>
                                </div>

                                {(!step.extractVariables || step.extractVariables.length === 0) && (
                                  <div style={{ fontSize: "11px", color: "#71717a", fontStyle: "italic", marginTop: "4px" }}>
                                    💡 No extraction rules configured. Click "+ Add Extraction Rule" to extract tokens, IDs, or data fields (e.g. <code>authToken = token</code>, <code>tripId = data.id</code>).
                                  </div>
                                )}

                                {(step.extractVariables || []).map((vRule, vIdx) => (
                                  <div key={vIdx} className="var-extract-row">
                                    <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "600" }}>
                                      {`{{`}
                                    </span>
                                    <input
                                      type="text"
                                      className="var-extract-input"
                                      style={{ width: "140px" }}
                                      placeholder="varName (e.g. authToken)"
                                      value={vRule.varName}
                                      onChange={(e) => handleUpdateExtractVar(idx, vIdx, "varName", e.target.value)}
                                    />
                                    <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "600" }}>
                                      {`}}`}
                                    </span>
                                    <span style={{ color: "#6c7086", fontSize: "11px" }}>= response.body.</span>
                                    <input
                                      type="text"
                                      className="var-extract-input"
                                      style={{ flex: 1 }}
                                      placeholder="JSON Path (e.g. token, data.id, 0.id)"
                                      value={vRule.jsonPath}
                                      onChange={(e) => handleUpdateExtractVar(idx, vIdx, "jsonPath", e.target.value)}
                                    />
                                    <button
                                      className="step-delete-btn"
                                      onClick={() => handleDeleteExtractVar(idx, vIdx)}
                                      title="Remove Rule"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* RUNNER & SELF-HEALING MODE */
            <>
              <div className="runner-status-bar">
                <div>
                  <strong>Pipeline Status: </strong>
                  {running ? (
                    <span style={{ color: "#89b4fa" }}>⏳ Executing Step {currentStepIdx + 1} of {steps.length}...</span>
                  ) : pausedForHealing ? (
                    <span style={{ color: "#f9e2af" }}>🛠️ Paused for Autonomous Self-Healing</span>
                  ) : stepResults.length > 0 ? (
                    stepResults.every(r => r && r.passed) ? (
                      <span style={{ color: "#a6e3a1" }}>✅ Pipeline Completed Successfully!</span>
                    ) : (
                      <span style={{ color: "#f38ba8" }}>❌ Pipeline Terminated with Failures</span>
                    )
                  ) : (
                    <span style={{ color: "#a6adc8" }}>Ready to execute</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="studio-run-btn" onClick={startFlowRun} disabled={running}>
                    {running ? "Running..." : "▶️ Start Flow"}
                  </button>
                </div>
              </div>

              {/* Execution Stepper */}
              <div className="runner-stepper">
                {steps.map((step, idx) => {
                  const result = stepResults[idx];
                  const isCurrent = running && currentStepIdx === idx;
                  const isPaused = pausedForHealing && pausedForHealing.stepIdx === idx;

                  let statusClass = "pending";
                  let statusTag = <span className="runner-step-status-tag">Pending</span>;

                  if (isCurrent) {
                    statusClass = "running";
                    statusTag = <span className="runner-step-status-tag running">⏳ Running</span>;
                  } else if (isPaused) {
                    statusClass = "failed";
                    statusTag = <span className="runner-step-status-tag failed">🔴 Failed ({pausedForHealing.status})</span>;
                  } else if (result) {
                    if (result.healed) {
                      statusClass = "healed";
                      statusTag = <span className="runner-step-status-tag healed">🛠️ Healed & Passed</span>;
                    } else if (result.passed) {
                      statusClass = "passed";
                      statusTag = <span className="runner-step-status-tag passed">✅ Passed ({result.status})</span>;
                    } else {
                      statusClass = "failed";
                      statusTag = <span className="runner-step-status-tag failed">❌ Failed ({result.status})</span>;
                    }
                  }

                  return (
                    <div key={step.stepId || idx} className={`runner-step-card ${statusClass}`}>
                      <div className="runner-step-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className="step-number-badge">{idx + 1}</span>
                          <span className="runner-step-title">{step.name}</span>
                          <span style={{ color: "#34d399", fontWeight: "700", fontSize: "11px" }}>{step.method}</span>
                          <span style={{ color: "#a1a1aa", fontSize: "11px", fontFamily: "monospace" }}>
                            {result?.url || renderHighlightedTemplate(step.url, runtimeVars)}
                          </span>
                        </div>
                        {statusTag}
                      </div>

                      {result && result.duration > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", color: "#71717a", flexWrap: "wrap", gap: "6px" }}>
                          <span>Response Time: {result.duration}ms {result.error && `| Error: ${result.error}`}</span>
                          {result.responseBody && (
                            <button
                              style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "10.5px", textDecoration: "underline", padding: 0 }}
                              onClick={() => toggleResponseView(idx)}
                            >
                              {expandedResponses[idx] ? "▲ Hide Response JSON" : "▼ View Response JSON"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable Response JSON Viewer */}
                      {expandedResponses[idx] && result?.responseBody && (
                        <div style={{ background: "#09090d", border: "1px solid #1f1f23", borderRadius: "4px", padding: "8px", maxHeight: "180px", overflowY: "auto", fontFamily: "monospace", fontSize: "10.5px", color: "#a6adc8", whiteSpace: "pre-wrap" }}>
                          {JSON.stringify(result.responseBody, null, 2)}
                        </div>
                      )}

                      {/* 📥 Output Variables from this Step */}
                      {result && (
                        <div className="runner-step-outputs-box">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                            <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#38bdf8" }}>
                              📥 Output Variables:
                            </span>
                          </div>
                          {result.extracted && Object.keys(result.extracted).length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                              {Object.entries(result.extracted).map(([outKey, outVal]) => (
                                renderExtractedVariableViewer(outKey, outVal, `step_${idx}`)
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: "10.5px", color: "#71717a", fontStyle: "italic" }}>
                              No variables extracted from this step.
                            </div>
                          )}
                        </div>
                      )}

                      {/* ⚡ Step Failure Diagnostics & Guidance */}
                      {isPaused && pausedForHealing && (
                        <div className="flow-healing-panel">
                          <div className="flow-healing-header">
                            <span style={{ fontSize: "16px" }}>⚡</span>
                            <span className="flow-healing-title">Step Failure Diagnostics & Recommendations</span>
                          </div>

                          <div className="flow-healing-desc">
                            {pausedForHealing.diagnosis?.why || pausedForHealing.diagnosis?.whatHappened || pausedForHealing.error || `Step failed with HTTP status ${pausedForHealing.status}.`}
                          </div>

                          {/* 🏛️ Retrieved Historical Evidence (RAG) */}
                          {pausedForHealing.retrievedEpisodes && pausedForHealing.retrievedEpisodes.length > 0 && (
                            <div style={{ background: "#0d0d12", border: "1px solid #1f1f23", padding: "6px 8px", borderRadius: "4px" }}>
                              <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#f5c2e7", display: "flex", gap: "6px", alignItems: "center", marginBottom: "3px" }}>
                                <span>🏛️</span>
                                <span>Retrieved Historical Evidence (RAG):</span>
                                <span style={{ color: "#34d399", fontSize: "9.5px", background: "rgba(16, 185, 129, 0.15)", padding: "1px 5px", borderRadius: "3px" }}>
                                  {pausedForHealing.retrievedEpisodes.length} Precedent(s) Found
                                </span>
                              </div>
                              {pausedForHealing.retrievedEpisodes.map((ep, epI) => (
                                <div key={epI} style={{ fontSize: "10px", color: "#a1a1aa", marginTop: "2px" }}>
                                  🎯 <strong>{ep.matchPercentage || 95}% Match</strong> — Precedent: <span style={{ color: "#34d399" }}>{ep.successfulFixUsed?.title || ep.successfulFixUsed?.description || "Historical resolution"}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Root Cause Layer */}
                          {pausedForHealing.diagnosis?.rootCause && (
                            <div style={{ fontSize: "11px", color: "#89b4fa", background: "rgba(137, 180, 250, 0.08)", padding: "5px 8px", borderRadius: "4px", border: "1px solid rgba(137, 180, 250, 0.2)" }}>
                              🔍 <strong>Predicted Layer:</strong> {pausedForHealing.diagnosis.rootCause.predictedLayer} ({pausedForHealing.diagnosis.rootCause.confidence}% confidence)
                              {pausedForHealing.diagnosis.rootCause.probableCause && (
                                <div style={{ color: "#cdd6f4", fontSize: "10.5px", marginTop: "2px" }}>
                                  Cause: {pausedForHealing.diagnosis.rootCause.probableCause}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actionable Steps */}
                          {pausedForHealing.diagnosis?.whatToDo && pausedForHealing.diagnosis.whatToDo.length > 0 && (
                            <div className="flow-what-to-do-box">
                              <span className="flow-what-to-do-title">📋 Recommended Actions:</span>
                              {pausedForHealing.diagnosis.whatToDo.map((stepItem, sIdx) => (
                                <div key={sIdx} className="flow-what-step">• {stepItem}</div>
                              ))}
                            </div>
                          )}

                          {/* Suggested Snippet Preview with Clean Copy Button */}
                          {pausedForHealing.diagnosis?.autoFix && (() => {
                            const cleanSnippet = getCleanSnippet(pausedForHealing.diagnosis.autoFix);
                            if (!cleanSnippet) return null;
                            return (
                              <div className="flow-suggested-snippet-box">
                                <div className="flow-snippet-header">
                                  <span className="flow-snippet-title">💡 Suggested Fix & Payload:</span>
                                  <button
                                    type="button"
                                    className="btn-flow-copy-snippet"
                                    onClick={() => {
                                      navigator.clipboard.writeText(cleanSnippet);
                                      showToast("📋 Clean payload snippet copied!");
                                    }}
                                    title="Copy clean snippet to clipboard"
                                  >
                                    📋 Copy Snippet
                                  </button>
                                </div>
                                <div className="flow-healing-diff">
                                  {cleanSnippet}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flow-healing-actions">
                            <button
                              type="button"
                              className="btn-flow-edit-step"
                              onClick={() => handleEditStepFromDiagnosis(pausedForHealing.stepIdx)}
                            >
                              ✏️ Edit Step in Builder
                            </button>
                            <button
                              type="button"
                              className="btn-flow-retry-step"
                              onClick={handleRetryFailedStep}
                            >
                              🔄 Retry Step
                            </button>
                            <button
                              type="button"
                              className="skip-flow-step-btn"
                              onClick={() => {
                                setPausedForHealing(null);
                                setRunning(false);
                              }}
                            >
                              ⏹️ Stop Run
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
