import React, { useState } from "react";
import ReactJson from "react-json-view";
import "./TestingTimelineModal.css";
import { showToast } from "../utils/toast";

export default function TestingTimelineModal({
  currentEndpoint = "",
  historyItems = [],
  onClose,
  onRestoreAttempt,
  onOpenCompare
}) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(() => {
    if (currentEndpoint) {
      try {
        const u = new URL(currentEndpoint);
        return `${u.origin}${u.pathname}`;
      } catch {
        return currentEndpoint.split("?")[0];
      }
    }
    return "";
  });

  const [expandedAttempt, setExpandedAttempt] = useState(null);

  // Group all history items by normalized endpoint (origin + pathname)
  const endpointMap = {};
  historyItems.forEach((item) => {
    let key = item.url || "";
    try {
      const u = new URL(item.url);
      key = `${item.method || "GET"} ${u.origin}${u.pathname}`;
    } catch {
      key = `${item.method || "GET"} ${(item.url || "").split("?")[0]}`;
    }

    if (!endpointMap[key]) {
      endpointMap[key] = [];
    }
    endpointMap[key].push(item);
  });

  const endpointKeys = Object.keys(endpointMap);

  // Default active key
  const activeKey =
    selectedEndpoint && endpointKeys.find((k) => k.includes(selectedEndpoint))
      ? endpointKeys.find((k) => k.includes(selectedEndpoint))
      : endpointKeys[0] || "";

  // Sort chronological (oldest to newest for progression timeline)
  const timelineAttempts = (endpointMap[activeKey] || []).slice().sort((a, b) => {
    const tA = new Date(a.time || 0).getTime();
    const tB = new Date(b.time || 0).getTime();
    return tA - tB;
  });

  const getStatusClass = (status) => {
    const s = String(status);
    if (s.startsWith("2")) return "status-node-2xx";
    if (s.startsWith("3")) return "status-node-3xx";
    if (s.startsWith("4")) return "status-node-4xx";
    if (s.startsWith("5") || s.startsWith("ERR")) return "status-node-5xx";
    return "status-node-unknown";
  };

  const getStatusIcon = (status) => {
    const s = String(status);
    if (s.startsWith("2")) return "✅";
    if (s.startsWith("3")) return "🔀";
    if (s.startsWith("4")) return "⚠️";
    if (s.startsWith("5") || s.startsWith("ERR")) return "❌";
    return "❓";
  };

  const handleRestore = (attempt) => {
    if (onRestoreAttempt) {
      onRestoreAttempt(attempt);
      showToast("📥 Attempt restored into request editor!");
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="timeline-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="timeline-modal-header">
          <div className="timeline-header-left">
            <span className="timeline-header-icon">🧬</span>
            <div>
              <h3 className="timeline-title">API Testing & Evolution Timeline</h3>
              <p className="timeline-subtitle">
                Track sequential execution attempts, failures, applied AI fixes, and recoveries
              </p>
            </div>
          </div>
          <button className="timeline-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Filter bar for endpoints */}
        <div className="timeline-endpoint-bar">
          <label className="endpoint-selector-label">Target Endpoint:</label>
          <select
            className="endpoint-select"
            value={activeKey}
            onChange={(e) => setSelectedEndpoint(e.target.value)}
          >
            {endpointKeys.length === 0 && <option>No execution history recorded yet</option>}
            {endpointKeys.map((k) => (
              <option key={k} value={k}>
                {k} ({endpointMap[k]?.length} attempts)
              </option>
            ))}
          </select>
        </div>

        {/* Timeline Body */}
        <div className="timeline-modal-body">
          {timelineAttempts.length === 0 ? (
            <div className="timeline-empty-state">
              <span style={{ fontSize: 32 }}>⏳</span>
              <p>No recorded execution attempts for this endpoint yet.</p>
              <span style={{ color: "#71717a", fontSize: 11 }}>
                Send requests from the main editor to build an evolution tree!
              </span>
            </div>
          ) : (
            <div className="timeline-flow-track">
              {timelineAttempts.map((attempt, index) => {
                const isExpanded = expandedAttempt === attempt._id || expandedAttempt === index;
                const statusStr = attempt.status ?? "ERR";
                const isSuccess = String(statusStr).startsWith("2");

                return (
                  <div key={attempt._id || index} className="timeline-node-card">
                    {/* Node connector line */}
                    {index < timelineAttempts.length - 1 && (
                      <div className="timeline-connector-line">
                        <span className="connector-arrow">▼</span>
                      </div>
                    )}

                    <div className={`timeline-node-inner ${getStatusClass(statusStr)}`}>
                      {/* Node Header */}
                      <div className="node-top-row">
                        <div className="node-index-badge">
                          Attempt {index + 1} of {timelineAttempts.length}
                        </div>
                        <div className="node-status-group">
                          <span className="node-status-icon">{getStatusIcon(statusStr)}</span>
                          <span className={`node-status-pill ${getStatusClass(statusStr)}`}>
                            {statusStr}
                          </span>
                          <span className="node-duration-pill">{attempt.duration || 0} ms</span>
                          <span className="node-time-pill">
                            {new Date(attempt.time || Date.now()).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* URL & Method */}
                      <div className="node-url-row">
                        <span className={`method-pill method-${(attempt.method || "GET").toLowerCase()}`}>
                          {attempt.method || "GET"}
                        </span>
                        <span className="node-url-text" title={attempt.url}>
                          {attempt.url}
                        </span>
                      </div>

                      {/* AI Diagnosis or Fix Badges */}
                      {attempt.appliedFix && (
                        <div className="node-fix-applied-badge">
                          <span className="fix-icon">🛠️</span>
                          <span>
                            Applied Fix: <strong>{attempt.appliedFix.title || "AI Auto-Fix"}</strong>
                          </span>
                        </div>
                      )}

                      {attempt.aiDiagnosis?.whatHappened && (
                        <div className="node-diagnosis-snippet">
                          <span className="diag-icon">🧠</span>
                          <span className="diag-text">{attempt.aiDiagnosis.whatHappened}</span>
                        </div>
                      )}

                      {isSuccess && index > 0 && (
                        <div className="node-success-milestone">
                          ✨ <strong>Evolution Complete:</strong> Request succeeded after resolving previous attempt failures!
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="node-actions-row">
                        <button
                          className="node-action-btn"
                          onClick={() => setExpandedAttempt(isExpanded ? null : (attempt._id || index))}
                        >
                          {isExpanded ? "▲ Hide Payload" : "▼ Inspect Payload & Response"}
                        </button>

                        <button
                          className="node-action-btn restore-btn"
                          onClick={() => handleRestore(attempt)}
                        >
                          📥 Load into Editor
                        </button>

                        {timelineAttempts.length >= 2 && onOpenCompare && (
                          <button
                            className="node-action-btn compare-btn"
                            onClick={() => {
                              const other = index === 0 ? timelineAttempts[1] : timelineAttempts[0];
                              onOpenCompare(other, attempt);
                            }}
                          >
                            ⚖️ Compare Diff
                          </button>
                        )}
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="node-expanded-panel">
                          <div className="payload-inspect-grid">
                            <div className="inspect-col">
                              <h5>Request Headers</h5>
                              <pre className="inspect-code-box">
                                {attempt.headers && Object.keys(attempt.headers).length > 0
                                  ? JSON.stringify(attempt.headers, null, 2)
                                  : "None"}
                              </pre>
                            </div>

                            <div className="inspect-col">
                              <h5>Request Payload</h5>
                              <pre className="inspect-code-box">
                                {attempt.requestBody
                                  ? typeof attempt.requestBody === "object"
                                    ? JSON.stringify(attempt.requestBody, null, 2)
                                    : String(attempt.requestBody)
                                  : "No body (GET/empty)"}
                              </pre>
                            </div>
                          </div>

                          <div className="inspect-col" style={{ marginTop: 8 }}>
                            <h5>Response Body</h5>
                            <div className="inspect-json-box">
                              {attempt.responseBody ? (
                                typeof attempt.responseBody === "object" ? (
                                  <ReactJson
                                    src={attempt.responseBody}
                                    theme="google"
                                    collapsed={2}
                                    displayDataTypes={false}
                                    style={{ fontSize: "11px", background: "transparent" }}
                                  />
                                ) : (
                                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                    {String(attempt.responseBody)}
                                  </pre>
                                )
                              ) : (
                                <span style={{ color: "#71717a" }}>No response body saved</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="timeline-modal-footer">
          <span className="timeline-footer-hint">
            💡 The Testing Timeline updates automatically with every API execution.
          </span>
          <button className="timeline-dismiss-btn" onClick={onClose}>
            [ CLOSE TIMELINE ]
          </button>
        </div>
      </div>
    </div>
  );
}
