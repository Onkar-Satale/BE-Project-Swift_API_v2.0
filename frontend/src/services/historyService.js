import { authenticatedFetch } from "./authService";

const HISTORY_API = `${process.env.REACT_APP_BACKEND_URL}/api/history`;
const HISTORY_CACHE_KEY = "swift_api_history_cache";

// Get user history with instant local cache + authenticated fetch
export const getHistory = async () => {
  // 1. Check local backup cache first for instant UI render
  let cached = [];
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  const token = localStorage.getItem("authToken");
  if (!token) {
    return Array.isArray(cached) ? cached : [];
  }

  try {
    const res = await authenticatedFetch(`${HISTORY_API}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Update local cache
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn("getHistory network fetch failed, using local cache:", err);
  }

  return Array.isArray(cached) ? cached : [];
};

// Save a new history entry
export const saveHistory = async (entry) => {
  try {
    // Optimistically update local cache
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = [entry, ...list.filter(x => x._id !== entry._id)].slice(0, 100);
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updated));
    } catch {}

    const res = await authenticatedFetch(HISTORY_API, {
      method: "POST",
      body: JSON.stringify(entry),
    });

    if (!res.ok) throw new Error("Failed to save history");
    return await res.json();
  } catch (err) {
    console.error("saveHistory error:", err);
    return { success: false, error: err.message };
  }
};

// Delete a single history item
export const deleteHistoryItem = async (historyId) => {
  try {
    // Optimistically remove from local cache
    try {
      const raw = localStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        const filtered = list.filter(item => (item._id !== historyId && item.id !== historyId));
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(filtered));
      }
    } catch {}

    const res = await authenticatedFetch(`${HISTORY_API}/${historyId}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Failed to delete history item");
    return await res.json();
  } catch (err) {
    console.error("deleteHistoryItem error:", err);
    return { success: false, error: err.message };
  }
};

// Clear all history
export const clearHistory = async () => {
  try {
    localStorage.removeItem(HISTORY_CACHE_KEY);

    const res = await authenticatedFetch(`${HISTORY_API}/clear`, {
      method: "PUT",
    });

    if (!res.ok) throw new Error("Failed to clear history");
    return await res.json();
  } catch (err) {
    console.error("clearHistory error:", err);
    return { success: false, error: err.message };
  }
};
