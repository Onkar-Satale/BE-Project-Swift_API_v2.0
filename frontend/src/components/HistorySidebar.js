import React, { useState, useEffect } from "react";
import "./HistorySidebar.css";

// Group by date only
function groupByDate(items) {
  const groups = {};

  const sorted = [...items].sort((a, b) => {
    const timeA = a.time ? new Date(a.time) : new Date(0);
    const timeB = b.time ? new Date(b.time) : new Date(0);
    return timeB - timeA;
  });

  sorted.forEach((h) => {
    let d = new Date(h.time);
    if (isNaN(d.getTime())) {
      d = new Date(0);
    }
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let label;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else {
      label = d.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(h);
  });

  return groups;
}

export default function HistorySidebar({
  items = [],
  onSelect,
  onDelete,
  onClear,
  onCountChange,
  onOpenTimeline,
  onOpenCompare
}) {
  const [collapsed, setCollapsed] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(items.length);
    }
  }, [items, onCountChange]);

  const toggleCompareSelect = (item) => {
    if (selectedForCompare.some((x) => x._id === item._id)) {
      setSelectedForCompare(selectedForCompare.filter((x) => x._id !== item._id));
    } else {
      if (selectedForCompare.length >= 2) {
        setSelectedForCompare([selectedForCompare[1], item]);
      } else {
        setSelectedForCompare([...selectedForCompare, item]);
      }
    }
  };

  const handleTriggerCompare = () => {
    if (selectedForCompare.length === 2 && onOpenCompare) {
      onOpenCompare(selectedForCompare[0], selectedForCompare[1]);
    }
  };

  const grouped = groupByDate(items);

  return (
    <aside className="history">
      {/* Single Item Delete Modal */}
      {itemToDelete && (
        <div className="modal-overlay">
          <div className="confirm-modal terminal-modal">
            <div className="modal-title">⚠️ DELETE REQUEST</div>
            <div className="modal-body-text">
              Do you want to delete this request from history?
            </div>
            <div className="modal-actions">
              <button className="btn-no" onClick={() => setItemToDelete(null)}>[ NO, CANCEL ]</button>
              <button
                className="btn-yes"
                onClick={() => {
                  onDelete(itemToDelete);
                  setItemToDelete(null);
                }}
              >
                [ YES, DELETE ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal terminal-modal">
            <div className="modal-title">⚠️ CLEAR HISTORY</div>
            <div className="modal-body-text">
              Do you really want to delete all requests in history?
            </div>
            <div className="modal-actions">
              <button className="btn-no" onClick={() => setShowClearConfirm(false)}>[ NO, CANCEL ]</button>
              <button
                className="btn-yes"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClear();
                }}
              >
                [ YES, DELETE ALL ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="history-header">
        <div className="history-header-title-group">
          <h3>History</h3>
          <span className="history-count-tag">{items.length}</span>
        </div>

        <div className="history-header-actions">
          {items.length > 0 && (
            <>
              {onOpenTimeline && (
                <button
                  className="history-tool-btn"
                  onClick={() => onOpenTimeline()}
                  title="Open Testing Timeline"
                >
                  🧬 Timeline
                </button>
              )}

              <button
                className={`history-tool-btn ${compareMode ? "active" : ""}`}
                onClick={() => {
                  setCompareMode(!compareMode);
                  setSelectedForCompare([]);
                }}
                title="Compare two history capsules"
              >
                ⚖️ Compare
              </button>
            </>
          )}

          <button className="clear-btn" onClick={() => setShowClearConfirm(true)}>Clear</button>
        </div>
      </div>

      {/* Compare Mode Banner */}
      {compareMode && (
        <div className="compare-mode-banner">
          <span>Select 2 items ({selectedForCompare.length}/2)</span>
          {selectedForCompare.length === 2 && (
            <button className="btn-start-compare" onClick={handleTriggerCompare}>
              Compare Now ➔
            </button>
          )}
        </div>
      )}

      {/* History List */}
      <div className="history-list">
        {items.length === 0 && (
          <div className="history-empty">No requests yet</div>
        )}

        {Object.entries(grouped).map(([date, list]) => (
          <div key={date} className="history-group">
            <button
              className="group-header"
              onClick={() =>
                setCollapsed({ ...collapsed, [date]: !collapsed[date] })
              }
            >
              {date}
              <span className="chevron">{collapsed[date] ? "▶" : "▼"}</span>
            </button>

            {!collapsed[date] && (
              <ul>
                {list.map((h) => {
                  const isSelectedForCompare = selectedForCompare.some((x) => x._id === h._id);

                  return (
                    <li
                      key={h._id}
                      className={`history-item ${isSelectedForCompare ? "selected-for-compare" : ""}`}
                    >
                      {compareMode && (
                        <input
                          type="checkbox"
                          className="compare-checkbox"
                          checked={isSelectedForCompare}
                          onChange={() => toggleCompareSelect(h)}
                        />
                      )}

                      <button
                        className="history-main"
                        onClick={() => {
                          if (compareMode) {
                            toggleCompareSelect(h);
                          } else {
                            onSelect(h);
                          }
                        }}
                      >
                        <span className={`method pill method-${h.method?.toLowerCase()}`}>
                          {h.method}
                        </span>
                        <span className="url" title={h.url}>{h.url}</span>
                      </button>

                      <div className="history-meta">
                        <span className={`status ${String(h.status).startsWith("ERR") || String(h.status).startsWith("4") || String(h.status).startsWith("5") ? "err" : ""}`}>
                          {h.status}
                        </span>
                        <span className="dot">•</span>
                        <span className="duration">{h.duration || 0} ms</span>
                        <span className="dot">•</span>
                        <span className="time">
                          {(() => {
                            const t = new Date(h.time);
                            return isNaN(t.getTime()) ? "00:00:00" : t.toLocaleTimeString();
                          })()}
                        </span>

                        {onOpenTimeline && (
                          <button
                            className="timeline-item-btn"
                            title="View Evolution Timeline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTimeline(h.url);
                            }}
                          >
                            🧬
                          </button>
                        )}

                        <button className="del" onClick={() => setItemToDelete(h._id)}>
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
