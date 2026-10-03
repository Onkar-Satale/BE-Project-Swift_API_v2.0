import React, { useState, useEffect } from "react";
import ReactJson from "react-json-view";
import { authenticatedFetch } from "../services/authService";
import "./HistoryComparisonModal.css";

export default function HistoryComparisonModal({
  attemptA,
  attemptB,
  allHistory = [],
  onClose,
  onSwap
}) {
  const [itemA, setItemA] = useState(attemptA || allHistory[0] || null);
  const [itemB, setItemB] = useState(attemptB || allHistory[1] || allHistory[0] || null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (attemptA) setItemA(attemptA);
    if (attemptB) setItemB(attemptB);
  }, [attemptA, attemptB]);

  const fetchAiComparison = React.useCallback(async () => {
    if (!itemA || !itemB) return;
    setLoadingAi(true);
    setComparisonResult(null);

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("authToken");

      const payload = {
        attemptA: {
          method: itemA.method,
          url: itemA.url,
          headers: itemA.headers || {},
          params: itemA.params || {},
          body: itemA.requestBody || null,
          status: itemA.status,
          duration: itemA.duration,
          response: itemA.responseBody || null,
        },
        attemptB: {
          method: itemB.method,
          url: itemB.url,
          headers: itemB.headers || {},
          params: itemB.params || {},
          body: itemB.requestBody || null,
          status: itemB.status,
          duration: itemB.duration,
          response: itemB.responseBody || null,
        }
      };

      const res = await authenticatedFetch(`${backendUrl}/api/ai/compare`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.comparison) {
        setComparisonResult(data.comparison);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    } finally {
      setLoadingAi(false);
    }
  }, [itemA, itemB]);

  useEffect(() => {
    if (itemA && itemB) {
      fetchAiComparison();
    }
  }, [fetchAiComparison, itemA, itemB]);

  if (!itemA || !itemB) {
    return null;
  }

  const getStatusColor = (status) => {
    const s = String(status);
    if (s.startsWith("2")) return "#22c55e";
    if (s.startsWith("3")) return "#3b82f6";
    if (s.startsWith("4")) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="compare-modal-header">
          <div className="compare-header-left">
            <span className="compare-header-icon">⚖️</span>
            <div>
              <h3 className="compare-title">History Capsule Comparison</h3>
              <p className="compare-subtitle">
                Side-by-side differential analysis & AI progression explanation
              </p>
            </div>
          </div>
          <div className="compare-header-actions">
            <button
              className="compare-swap-btn"
              onClick={() => {
                const temp = itemA;
                setItemA(itemB);
                setItemB(temp);
              }}
              title="Swap Attempts"
            >
              🔄 Swap A ⇄ B
            </button>
            <button className="compare-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Selector Bar */}
        <div className="compare-selectors-bar">
          <div className="selector-group">
            <label>Attempt A (Baseline):</label>
            <select
              value={itemA._id || ""}
              onChange={(e) => {
                const found = allHistory.find((h) => h._id === e.target.value);
                if (found) setItemA(found);
              }}
            >
              {allHistory.map((h, i) => (
                <option key={h._id || i} value={h._id}>
                  [{h.status}] {h.method} {h.url?.slice(0, 35)}... ({new Date(h.time).toLocaleTimeString()})
                </option>
              ))}
            </select>
          </div>

          <div className="vs-badge">VS</div>

          <div className="selector-group">
            <label>Attempt B (Comparison):</label>
            <select
              value={itemB._id || ""}
              onChange={(e) => {
                const found = allHistory.find((h) => h._id === e.target.value);
                if (found) setItemB(found);
              }}
            >
              {allHistory.map((h, i) => (
                <option key={h._id || i} value={h._id}>
                  [{h.status}] {h.method} {h.url?.slice(0, 35)}... ({new Date(h.time).toLocaleTimeString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Body */}
        <div className="compare-modal-body">
          {/* AI Explanation Banner */}
          <div className="ai-comparison-banner">
            <div className="ai-banner-header">
              <span className="ai-brain-icon">🧠</span>
              <span className="ai-banner-title">J.A.R.V.I.S. Differential Analysis</span>
              {loadingAi && <span className="ai-loading-tag">Analyzing differences...</span>}
            </div>

            {loadingAi ? (
              <div className="ai-loading-skeleton">
                <div className="skeleton-line" />
                <div className="skeleton-line" style={{ width: "80%" }} />
              </div>
            ) : comparisonResult ? (
              <div className="ai-explanation-content">
                {comparisonResult.statusComparison?.summary && (
                  <div className="diff-highlight-pill">
                    📌 {comparisonResult.statusComparison.summary} (Timing: {comparisonResult.timingComparison?.insight || "N/A"})
                  </div>
                )}
                <p className="ai-explanation-text">
                  {comparisonResult.aiExplanation}
                </p>

                {comparisonResult.detectedChanges && comparisonResult.detectedChanges.length > 0 && (
                  <div className="detected-changes-list">
                    <h6>Detected Structural Modifications:</h6>
                    {comparisonResult.detectedChanges.map((change, idx) => (
                      <div key={idx} className="change-item">
                        <span className="change-field">{change.field}:</span>
                        <span className="change-from">A: {change.attemptA}</span>
                        <span className="change-arrow">➔</span>
                        <span className="change-to">B: {change.attemptB}</span>
                        {change.impact && <span className="change-impact">({change.impact})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="ai-explanation-text" style={{ color: "#71717a" }}>
                Select two history capsules to generate AI differential diagnostics.
              </p>
            )}
          </div>

          {/* Side-by-side Capsule Grid */}
          <div className="capsules-side-by-side-grid">
            {/* Column A */}
            <div className="capsule-column col-a">
              <div className="capsule-col-header">
                <h4>ATTEMPT A</h4>
                <span
                  className="capsule-status-pill"
                  style={{ backgroundColor: `${getStatusColor(itemA.status)}22`, color: getStatusColor(itemA.status), border: `1px solid ${getStatusColor(itemA.status)}` }}
                >
                  {itemA.status} ({itemA.duration || 0} ms)
                </span>
              </div>

              <div className="capsule-meta-box">
                <div className="capsule-field">
                  <span className="f-label">Method & URL:</span>
                  <div className="f-value">
                    <span className={`method-pill method-${(itemA.method || "GET").toLowerCase()}`}>{itemA.method}</span>
                    <span className="f-url">{itemA.url}</span>
                  </div>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Headers:</span>
                  <pre className="f-pre-box">
                    {itemA.headers && Object.keys(itemA.headers).length > 0
                      ? JSON.stringify(itemA.headers, null, 2)
                      : "None"}
                  </pre>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Request Payload:</span>
                  <pre className="f-pre-box">
                    {itemA.requestBody
                      ? typeof itemA.requestBody === "object"
                        ? JSON.stringify(itemA.requestBody, null, 2)
                        : String(itemA.requestBody)
                      : "None (GET/empty)"}
                  </pre>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Response Body:</span>
                  <div className="f-json-box">
                    {itemA.responseBody ? (
                      typeof itemA.responseBody === "object" ? (
                        <ReactJson
                          src={itemA.responseBody}
                          theme="google"
                          collapsed={2}
                          displayDataTypes={false}
                          style={{ fontSize: "11px", background: "transparent" }}
                        />
                      ) : (
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{String(itemA.responseBody)}</pre>
                      )
                    ) : (
                      <span style={{ color: "#71717a" }}>Empty</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Column B */}
            <div className="capsule-column col-b">
              <div className="capsule-col-header">
                <h4>ATTEMPT B</h4>
                <span
                  className="capsule-status-pill"
                  style={{ backgroundColor: `${getStatusColor(itemB.status)}22`, color: getStatusColor(itemB.status), border: `1px solid ${getStatusColor(itemB.status)}` }}
                >
                  {itemB.status} ({itemB.duration || 0} ms)
                </span>
              </div>

              <div className="capsule-meta-box">
                <div className="capsule-field">
                  <span className="f-label">Method & URL:</span>
                  <div className="f-value">
                    <span className={`method-pill method-${(itemB.method || "GET").toLowerCase()}`}>{itemB.method}</span>
                    <span className="f-url">{itemB.url}</span>
                  </div>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Headers:</span>
                  <pre className="f-pre-box">
                    {itemB.headers && Object.keys(itemB.headers).length > 0
                      ? JSON.stringify(itemB.headers, null, 2)
                      : "None"}
                  </pre>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Request Payload:</span>
                  <pre className="f-pre-box">
                    {itemB.requestBody
                      ? typeof itemB.requestBody === "object"
                        ? JSON.stringify(itemB.requestBody, null, 2)
                        : String(itemB.requestBody)
                      : "None (GET/empty)"}
                  </pre>
                </div>

                <div className="capsule-field">
                  <span className="f-label">Response Body:</span>
                  <div className="f-json-box">
                    {itemB.responseBody ? (
                      typeof itemB.responseBody === "object" ? (
                        <ReactJson
                          src={itemB.responseBody}
                          theme="google"
                          collapsed={2}
                          displayDataTypes={false}
                          style={{ fontSize: "11px", background: "transparent" }}
                        />
                      ) : (
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{String(itemB.responseBody)}</pre>
                      )
                    ) : (
                      <span style={{ color: "#71717a" }}>Empty</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="compare-modal-footer">
          <button className="compare-dismiss-btn" onClick={onClose}>
            [ CLOSE COMPARISON ]
          </button>
        </div>
      </div>
    </div>
  );
}
