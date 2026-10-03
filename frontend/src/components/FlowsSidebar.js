import React, { useState, useEffect } from "react";
import { getFlows, createFlow, deleteFlow } from "../services/flowService";
import "./FlowsSidebar.css";

export default function FlowsSidebar({ onOpenStudio, onRunFlow, refreshKey }) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFlows = async () => {
    setLoading(true);
    const list = await getFlows();
    setFlows(Array.isArray(list) ? list : []);
    setLoading(false);
  };

  useEffect(() => {
    loadFlows();
  }, [refreshKey]);

  const handleCreateDemo = async () => {
    const demoFlow = {
      name: "Research Self-Healing API Chain",
      description: "Step 1 extracts postId -> Step 2 fails with route typo -> Self-heals with RAG & resumes Step 3.",
      steps: [
        {
          stepId: "step_1",
          name: "Fetch Initial Post",
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/posts/1",
          headers: {},
          params: {},
          body: null,
          extractVariables: [
            { varName: "postId", jsonPath: "id" }
          ],
          expectedStatus: 200
        },
        {
          stepId: "step_2",
          name: "Fetch Post Comments (Intentional Typo)",
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/commentss?postId={{postId}}",
          headers: {},
          params: {},
          body: null,
          extractVariables: [
            { varName: "firstCommentId", jsonPath: "0.id" }
          ],
          expectedStatus: 200
        },
        {
          stepId: "step_3",
          name: "Verify Healed Downstream Pipeline",
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/posts/{{postId}}",
          headers: {},
          params: {},
          body: null,
          extractVariables: [],
          expectedStatus: 200
        }
      ]
    };

    const created = await createFlow(demoFlow);
    if (created) {
      await loadFlows();
      if (onOpenStudio) onOpenStudio(created);
    }
  };

  const handleDelete = async (e, flowId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this flow?")) {
      const ok = await deleteFlow(flowId);
      if (ok) {
        setFlows(prev => prev.filter(f => f._id !== flowId));
      }
    }
  };

  return (
    <div className="flows-sidebar">
      <div className="flows-header">
        <h3>🔀 Multi-Step Flows</h3>
        <button
          className="new-flow-btn"
          onClick={() => {
            if (onOpenStudio) onOpenStudio(null); // new empty flow
          }}
        >
          + New Flow
        </button>
      </div>

      <div className="flows-list">
        {loading ? (
          <div className="flows-empty-state">Loading flows...</div>
        ) : flows.length === 0 ? (
          <div className="flows-empty-state">
            <div className="empty-flow-icon">⛓️</div>
            <p>No API flows created yet.</p>
            <p style={{ fontSize: "11px", color: "#a6adc8" }}>
              Chain requests together with dynamic dependency passing and self-healing error recovery.
            </p>
            <button className="create-demo-flow-btn" onClick={handleCreateDemo}>
              ⚡ Load Research Demo Flow
            </button>
          </div>
        ) : (
          flows.map((flow) => {
            const stepCount = flow.steps?.length || 0;
            const lastRun = flow.lastRun;
            let statusBadge = null;

            if (lastRun && lastRun.timestamp) {
              if (lastRun.healedStepsCount > 0 && lastRun.passed) {
                statusBadge = <span className="flow-status-pill healed">🛠️ Healed ({lastRun.healedStepsCount})</span>;
              } else if (lastRun.passed) {
                statusBadge = <span className="flow-status-pill passed">✅ Passed</span>;
              } else {
                statusBadge = <span className="flow-status-pill failed">❌ Failed</span>;
              }
            }

            return (
              <div
                key={flow._id}
                className="flow-card"
                onClick={() => onOpenStudio && onOpenStudio(flow)}
              >
                <div className="flow-card-top">
                  <span className="flow-card-title">{flow.name}</span>
                  {statusBadge}
                </div>

                {flow.description && (
                  <div className="flow-card-desc">{flow.description}</div>
                )}

                <div className="flow-card-meta">
                  <span className="flow-steps-pill">
                    {stepCount} Step{stepCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ color: "#6c7086" }}>
                    {flow.updatedAt ? new Date(flow.updatedAt).toLocaleDateString() : ""}
                  </span>
                </div>

                <div className="flow-card-actions">
                  <button
                    className="flow-action-btn run"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRunFlow) onRunFlow(flow);
                    }}
                  >
                    🚀 Run
                  </button>
                  <button
                    className="flow-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenStudio) onOpenStudio(flow);
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="flow-action-btn delete"
                    onClick={(e) => handleDelete(e, flow._id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
