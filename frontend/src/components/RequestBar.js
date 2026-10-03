export default function RequestBar({ url, setUrl, setParamsObj }) {
  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (!setParamsObj) return;

    if (newUrl.includes("?")) {
      const queryPart = newUrl.substring(newUrl.indexOf("?") + 1);
      try {
        const searchParams = new URLSearchParams(queryPart);
        const parsed = [];
        searchParams.forEach((val, key) => {
          parsed.push({ key, value: val, description: "" });
        });
        parsed.push({ key: "", value: "", description: "" });
        setParamsObj(parsed);
      } catch {
        // ignore malformed query strings while typing
      }
    } else {
      setParamsObj([{ key: "", value: "", description: "" }]);
    }
  };

  const handleClearUrl = () => {
    setUrl("");
    if (setParamsObj) {
      setParamsObj([{ key: "", value: "", description: "" }]);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
      <input
        type="text"
        value={url || ""}
        onChange={handleUrlChange}
        placeholder="Enter request URL (e.g. https://jsonplaceholder.typicode.com/comments)"
        className="url-input"
        style={{ width: "100%", paddingRight: url ? "28px" : "10px" }}
      />
      {url && (
        <button
          type="button"
          onClick={handleClearUrl}
          title="Clear URL & Parameters"
          style={{
            position: "absolute",
            right: "8px",
            background: "transparent",
            border: "none",
            color: "var(--terminal-text-dim, #888)",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: "1",
            padding: "2px 4px"
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
