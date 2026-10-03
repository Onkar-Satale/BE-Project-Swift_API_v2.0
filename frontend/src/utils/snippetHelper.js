/**
 * 🛠️ Clean Snippet Extractor
 * Extracts valid, pasteable JSON, URLs, or Header values from AI diagnostics
 * by stripping Git diff markings (- / + / prefixes like "Body: None").
 */
export function getCleanSnippet(autoFix) {
  if (!autoFix) return "";

  // 1. If explicit actionPayload value exists
  if (autoFix.actionPayload && autoFix.actionPayload.value) {
    const val = autoFix.actionPayload.value;
    if (typeof val === "object") {
      return JSON.stringify(val, null, 2);
    }
    if (typeof val === "string") {
      let str = val.trim();
      str = str.replace(/^\+\s*(?:Body:\s*|URL:\s*|Headers?:\s*|Endpoint:\s*)?/i, "").trim();
      try {
        const parsed = JSON.parse(str);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return str;
      }
    }
  }

  // 2. Parse diff string
  const diff = autoFix.diff || autoFix.suggestedSnippet;
  if (!diff || typeof diff !== "string") return "";

  const lines = diff.split("\n");

  // Check for lines starting with "+"
  const plusLines = lines.filter((l) => l.trim().startsWith("+"));
  if (plusLines.length > 0) {
    const cleaned = plusLines
      .map((l) =>
        l.replace(/^\+\s*(?:Body:\s*|URL:\s*|Headers?:\s*|Endpoint:\s*)?/i, "").trim()
      )
      .join("\n")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return cleaned;
    }
  }

  // If no "+" lines, filter out lines starting with "-"
  const nonMinusLines = lines
    .filter((l) => !l.trim().startsWith("-"))
    .map((l) => l.replace(/^(?:Body:\s*|URL:\s*|Headers?:\s*|Endpoint:\s*)?/i, "").trim())
    .join("\n")
    .trim();

  if (nonMinusLines) {
    try {
      const parsed = JSON.parse(nonMinusLines);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return nonMinusLines;
    }
  }

  return diff.replace(/^[-+]\s*/gm, "").trim();
}
