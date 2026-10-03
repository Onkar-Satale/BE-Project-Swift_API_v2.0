import React, { useEffect } from "react";
import "./HeadersTab.css";

const HeadersTab = ({ headers, setHeaders }) => {
  // Ensure at least one empty row always exists
  useEffect(() => {
    if (!headers || headers.length === 0) {
      setHeaders([{ key: "", value: "", description: "" }]);
    }
  }, [headers, setHeaders]);

  const handleChange = (index, field, value) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const removeRow = (index) => {
    const updated = [...headers];

    // Prevent deleting the final empty row
    if (index === updated.length - 1) return;

    updated.splice(index, 1);

    if (updated.length === 0) {
      updated.push({ key: "", value: "", description: "" });
    }

    setHeaders(updated);
  };

  return (
    <div className="headers-tab">
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
          {headers.map((header, idx) => (
            <tr key={idx}>
              <td>
                <input
                  type="text"
                  placeholder="Key"
                  value={header.key}
                  onChange={(e) =>
                    handleChange(idx, "key", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) =>
                    handleChange(idx, "value", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="text"
                  placeholder="Description"
                  value={header.description || ""}
                  onChange={(e) =>
                    handleChange(idx, "description", e.target.value)
                  }
                />
              </td>

              <td>
                {/* Hide delete button for last empty row */}
                {idx !== headers.length - 1 && (
                  <button
                    className="remove-btn"
                    onClick={() => removeRow(idx)}
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
};

export default HeadersTab;
