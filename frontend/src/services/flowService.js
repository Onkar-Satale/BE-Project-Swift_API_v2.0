import { authenticatedFetch } from "./authService";

const FLOWS_API = `${process.env.REACT_APP_BACKEND_URL}/api/flows`;
const FLOWS_CACHE_KEY = "swift_api_flows_cache";

// Helper to get local flows cache
const getLocalFlows = () => {
  try {
    const raw = localStorage.getItem(FLOWS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Helper to set local flows cache
const setLocalFlows = (list) => {
  try {
    localStorage.setItem(FLOWS_CACHE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to set local flows cache:", err);
  }
};

// Fetch all user flows with instant local cache fallback
export const getFlows = async () => {
  const cached = getLocalFlows();
  const token = localStorage.getItem("authToken");

  if (!token) return Array.isArray(cached) ? cached : [];

  try {
    const res = await authenticatedFetch(FLOWS_API);
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Merge with any local offline flows if needed
        const localOnly = (Array.isArray(cached) ? cached : []).filter(
          f => f._id && f._id.startsWith('local_')
        );
        const merged = [...localOnly, ...data];
        setLocalFlows(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn("getFlows network error, using cached flows:", err);
  }

  return Array.isArray(cached) ? cached : [];
};

// Fetch single flow by ID
export const getFlowById = async (flowId) => {
  if (!flowId) return null;
  const cached = getLocalFlows();
  const foundLocal = cached.find(f => f._id === flowId);

  if (flowId.startsWith('local_')) {
    return foundLocal || null;
  }

  try {
    const res = await authenticatedFetch(`${FLOWS_API}/${flowId}`);
    if (res && res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("getFlowById error:", err);
  }

  return foundLocal || null;
};

// Create a new flow
export const createFlow = async (flowData) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    try {
      const res = await authenticatedFetch(FLOWS_API, {
        method: "POST",
        body: JSON.stringify(flowData),
      });
      if (res && res.ok) {
        const data = await res.json();
        const current = getLocalFlows();
        const filtered = current.filter(f => f._id !== data._id);
        setLocalFlows([data, ...filtered]);
        return data;
      }
    } catch (err) {
      console.warn("createFlow remote failed, falling back to local:", err);
    }
  }

  // Fallback / Guest mode persistence in localStorage
  const localFlow = {
    ...flowData,
    _id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const current = getLocalFlows();
  setLocalFlows([localFlow, ...current]);
  return localFlow;
};

// Update an existing flow
export const updateFlow = async (flowId, flowData) => {
  if (!flowId) return null;
  const token = localStorage.getItem("authToken");

  if (token && !flowId.startsWith('local_')) {
    try {
      const res = await authenticatedFetch(`${FLOWS_API}/${flowId}`, {
        method: "PUT",
        body: JSON.stringify(flowData),
      });
      if (res && res.ok) {
        const data = await res.json();
        const current = getLocalFlows();
        const updated = current.map(f => f._id === flowId ? data : f);
        setLocalFlows(updated);
        return data;
      }
    } catch (err) {
      console.warn("updateFlow remote failed, updating local cache:", err);
    }
  }

  // Local update fallback
  const current = getLocalFlows();
  const existing = current.find(f => f._id === flowId);
  const updatedFlow = {
    ...(existing || {}),
    ...flowData,
    _id: flowId,
    updatedAt: new Date().toISOString()
  };

  const updatedList = current.some(f => f._id === flowId)
    ? current.map(f => f._id === flowId ? updatedFlow : f)
    : [updatedFlow, ...current];

  setLocalFlows(updatedList);
  return updatedFlow;
};

// Delete a flow
export const deleteFlow = async (flowId) => {
  if (!flowId) return false;
  const token = localStorage.getItem("authToken");

  if (token && !flowId.startsWith('local_')) {
    try {
      await authenticatedFetch(`${FLOWS_API}/${flowId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("deleteFlow remote failed, removing locally:", err);
    }
  }

  const current = getLocalFlows();
  const filtered = current.filter(f => f._id !== flowId);
  setLocalFlows(filtered);
  return true;
};

// Save flow run results & self-healing logs
export const saveFlowRunResults = async (flowId, lastRunData, mutatedSteps) => {
  if (!flowId) return null;
  const token = localStorage.getItem("authToken");

  if (token && !flowId.startsWith('local_')) {
    try {
      const res = await authenticatedFetch(`${FLOWS_API}/${flowId}/run-results`, {
        method: "POST",
        body: JSON.stringify({
          lastRun: lastRunData,
          steps: mutatedSteps
        }),
      });
      if (res && res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.warn("saveFlowRunResults remote failed:", err);
    }
  }

  // Save run results to local cache
  const current = getLocalFlows();
  const updated = current.map(f => {
    if (f._id === flowId) {
      return {
        ...f,
        lastRun: lastRunData,
        steps: mutatedSteps || f.steps,
        updatedAt: new Date().toISOString()
      };
    }
    return f;
  });
  setLocalFlows(updated);

  return { success: true, flowId };
};
