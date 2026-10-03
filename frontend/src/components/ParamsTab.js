import { useEffect } from "react";
import "./ParamsTab.css";

export default function ParamsTab({ paramsObj, setParamsObj, url = "", setUrl = null }) {
  // Ensure at least one empty row always exists
  useEffect(() => {
    if (!paramsObj || paramsObj.length === 0) {
      setParamsObj([{ key: "", value: "", description: "" }]);
    }
  }, [paramsObj, setParamsObj]);

  // Cleaner → ensure exactly ONE empty row at the end
  const cleanParams = (arr) => {
    const filled = arr.filter(
      (p) =>
        p.key.trim() !== "" ||
        p.value.trim() !== "" ||
        p.description.trim() !== ""
    );

    return [...filled, { key: "", value: "", description: "" }];
  };

  const syncUrlWithParams = (updatedParams) => {
    if (!setUrl) return;
    const baseUrl = (url || "").split("?")[0].trim();
    const valid = updatedParams.filter((p) => p.key && p.key.trim() !== "");

    if (valid.length > 0) {
      const qs = valid
        .map(
          (p) =>
            `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(
              p.value ? p.value.trim() : ""
            )}`
        )
        .join("&");
      setUrl(`${baseUrl}?${qs}`);
    } else {
      setUrl(baseUrl);
    }
  };

  const handleChange = (index, field, value) => {
    const updated = [...paramsObj];
    updated[index][field] = value;
    const cleaned = cleanParams(updated);
    setParamsObj(cleaned);
    syncUrlWithParams(cleaned);
  };

  const removeRow = (index) => {
    const updated = [...paramsObj];
    if (index === updated.length - 1) return;

    updated.splice(index, 1);
    if (updated.length === 0) {
      updated.push({ key: "", value: "", description: "" });
    }

    const cleaned = cleanParams(updated);
    setParamsObj(cleaned);
    syncUrlWithParams(cleaned);
  };

  const clearAllParams = () => {
    const empty = [{ key: "", value: "", description: "" }];
    setParamsObj(empty);
    if (setUrl) {
      const baseUrl = (url || "").split("?")[0].trim();
      setUrl(baseUrl);
    }
  };

  const hasParams = (paramsObj || []).some((p) => p.key && p.key.trim() !== "");

  return (
    <div className="params-tab">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--terminal-text-dim, #888)" }}>Query Parameters</span>
        {hasParams && (
          <button
            type="button"
            onClick={clearAllParams}
            style={{
              background: "transparent",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            🧹 Clear All Params
          </button>
        )}
      </div>

      <table className="params-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Description</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {(paramsObj || []).map((param, idx) => (
            <tr key={idx}>
              <td>
                <input
                  type="text"
                  placeholder="Key"
                  value={param.key}
                  onChange={(e) =>
                    handleChange(idx, "key", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="text"
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) =>
                    handleChange(idx, "value", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="text"
                  placeholder="Description"
                  value={param.description}
                  onChange={(e) =>
                    handleChange(idx, "description", e.target.value)
                  }
                />
              </td>

              <td>
                {idx !== (paramsObj || []).length - 1 && (
                  <button
                    className="remove-btn"
                    onClick={() => removeRow(idx)}
                    title="Remove parameter"
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
  );
}
