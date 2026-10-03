import { useState, useEffect, useRef, useContext, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import ReactJson from "react-json-view";

import MethodDropdown from "./MethodDropdown";
import HeadersTab from "./HeadersTab";
import BodyTab from "./BodyTab";
import HistorySidebar from "../components/HistorySidebar";
import ParamsTab from "./ParamsTab";
import RequestBar from "./RequestBar";
import AuthorizationTab from "./AuthorizationTab";
import FlowsSidebar from "./FlowsSidebar";
import { getHistory, deleteHistoryItem, clearHistory } from "../services/historyService";
import { authenticatedFetch } from "../services/authService";
import { SwiftAPIContext } from "../context/SwiftAPIContext";
import { showToast } from "../utils/toast";
import "./SwiftAPIClient.css";

// ⚡ Lazy loaded heavy modals to minimize initial bundle size and accelerate startup
const AccountPage = lazy(() => import("./AccountPage"));
const BotSidebar = lazy(() => import("./BotSidebar"));
const TestingTimelineModal = lazy(() => import("./TestingTimelineModal"));
const HistoryComparisonModal = lazy(() => import("./HistoryComparisonModal"));
const FlowStudioModal = lazy(() => import("./FlowStudioModal"));


const getUserIdFromToken = () => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId || payload.id || payload._id || null;
  } catch {
    return null;
  }
};

export default function SwiftAPIClient() {
  const {
    method, setMethod,
    url, setUrl,
    headersObj, setHeadersObj,
    paramsObj, setParamsObj,
    rawBody, setRawBody,
    activeTab, setActiveTab,
    response, setResponse,
    status, setStatus,
    setMessages,
    auth, setAuth,
    appliedFixInfo, setAppliedFixInfo
  } = useContext(SwiftAPIContext);

  const [history, setHistory] = useState(() => {
    try {
      const userId = getUserIdFromToken();
      if (!userId) return [];
      const saved = localStorage.getItem(`userHistory_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const userId = getUserIdFromToken();
    if (userId) {
      localStorage.setItem(`userHistory_${userId}`, JSON.stringify(history));
    }
  }, [history]);

  const [activePanel, setActivePanel] = useState(
    sessionStorage.getItem("activePanel") || null
  );
  const [flowsRefreshKey, setFlowsRefreshKey] = useState(0);

  useEffect(() => {
    if (activePanel) {
      sessionStorage.setItem("activePanel", activePanel);
    } else {
      sessionStorage.removeItem("activePanel");
    }
  }, [activePanel]);

  const [viewMode, setViewMode] = useState(
    sessionStorage.getItem("viewMode") || "pretty"
  );

  useEffect(() => {
    sessionStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Modals state for V2
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineTargetUrl, setTimelineTargetUrl] = useState("");
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareAttemptA, setCompareAttemptA] = useState(null);
  const [compareAttemptB, setCompareAttemptB] = useState(null);
  const [flowStudioModal, setFlowStudioModal] = useState(null); // { flow, initialMode: "builder" | "runner" }

  // Clear error message immediately when URL changes
  useEffect(() => {
    setErrorMsg("");
  }, [url]);

  const navigate = useNavigate();
  const responseRef = useRef(null);
  const [responseHeight, setResponseHeight] = useState(() => {
    return parseInt(sessionStorage.getItem("responseHeight")) || 300;
  });

  useEffect(() => {
    sessionStorage.setItem("responseHeight", responseHeight);
  }, [responseHeight]);

  const [showBot, setShowBot] = useState(
    sessionStorage.getItem("showBot") === "true"
  );

  useEffect(() => {
    sessionStorage.setItem("showBot", showBot);
  }, [showBot]);

  // 🔹 Sync auth to headersObj automatically
  useEffect(() => {
    if (auth.type === "bearer" && auth.token) {
      setHeadersObj(prev => {
        const otherHeaders = prev.filter(h => h.key !== "Authorization");
        return [
          ...otherHeaders,
          { key: "Authorization", value: `Bearer ${auth.token}` },
          ...prev.filter(h => h.key === ""),
        ];
      });
    } else if (auth.type === "basic" && auth.username && auth.password) {
      const encoded = btoa(`${auth.username}:${auth.password}`);
      setHeadersObj(prev => {
        const otherHeaders = prev.filter(h => h.key !== "Authorization");
        return [
          ...otherHeaders,
          { key: "Authorization", value: `Basic ${encoded}` },
          ...prev.filter(h => h.key === ""),
        ];
      });
    } else if (auth.type === "none") {
      setHeadersObj(prev => prev.filter(h => h.key !== "Authorization"));
    }
  }, [auth, setHeadersObj]);

  const [bodyType, setBodyType] = useState("none");
  const [formDataList, setFormDataList] = useState([
    { key: "", value: "", description: "" }
  ]);
  const [urlencodedList, setUrlencodedList] = useState([
    { key: "", value: "", description: "" }
  ]);
  const [apiContext, setApiContext] = useState(null);

  const startResizing = (e) => {
    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startHeight = responseRef.current.offsetHeight;

    const doDrag = (event) => {
      if (event.type === 'touchmove') {
        event.preventDefault();
      }
      const currentY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY;
      const newHeight = startHeight - (currentY - startY);
      setResponseHeight(newHeight > 100 ? newHeight : 100);
    };

    const stopDrag = () => {
      if (isTouch) {
        document.removeEventListener("touchmove", doDrag);
        document.removeEventListener("touchend", stopDrag);
      } else {
        document.removeEventListener("mousemove", doDrag);
        document.removeEventListener("mouseup", stopDrag);
      }
    };

    if (isTouch) {
      document.addEventListener("touchmove", doDrag, { passive: false });
      document.addEventListener("touchend", stopDrag);
    } else {
      document.addEventListener("mousemove", doDrag);
      document.addEventListener("mouseup", stopDrag);
    }
  };

  const cleanParams = (arr) => {
    const filled = arr.filter(
      (p) =>
        p.key.trim() !== "" ||
        p.value.trim() !== "" ||
        p.description.trim() !== ""
    );
    return [...filled, { key: "", value: "", description: "" }];
  };

  const cleanHeaders = (arr) => {
    const filled = arr.filter(
      (h) =>
        h.key.trim() !== "" ||
        h.value.trim() !== "" ||
        (h.description && h.description.trim() !== "")
    );
    return [...filled, { key: "", value: "", description: "" }];
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.id || payload._id;
      if (userId) {
        localStorage.setItem("currentUserId", userId);
      }
    } catch (err) {
      console.error("Failed to decode token:", err);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const [lastResponse, setLastResponse] = useState(
    JSON.parse(sessionStorage.getItem("lastResponse") || "null")
  );
  const [lastRequest, setLastRequest] = useState(
    JSON.parse(sessionStorage.getItem("lastRequest") || "null")
  );

  const loadUserHistory = async () => {
    try {
      const h = await getHistory();
      setHistory(Array.isArray(h) ? h : []);
    } catch (err) {
      console.error("Failed to load history:", err);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadUserHistory();

    if (!lastResponse) {
      setResponse("");
      setStatus(null);
    } else {
      setResponse(lastResponse);
      if (lastRequest) setStatus(lastRequest.status ?? null);
    }

    if (lastRequest) {
      setMethod(lastRequest.method || "GET");
      let cleanInitUrl = lastRequest.url || "";
      if (cleanInitUrl.includes("?url=") || cleanInitUrl.includes("&url=")) {
        cleanInitUrl = cleanInitUrl.split("?")[0];
      }
      setUrl(cleanInitUrl);
      if (lastRequest.body) {
        setRawBody(typeof lastRequest.body === "object" ? JSON.stringify(lastRequest.body, null, 2) : String(lastRequest.body));
      }

      setApiContext({
        method: lastRequest.method || "GET",
        url: lastRequest.url || "",
        headers: headersObj.reduce((acc, h) => {
          if (h.key) acc[h.key] = h.value;
          return acc;
        }, {}),
        status: lastRequest.status ?? "OK",
        responseTime: 0,
        response: lastResponse || { error: "No response available" }
      });
    }
  }, []);

  const isValidUrl = (str) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  // -------------------------------------------------------------
  // 🔹 V2: AUTOMATIC AI FAILURE ASSISTANT TRIGGER
  // -------------------------------------------------------------
  const triggerAutoFailureAssistant = async ({
    method,
    url,
    headers,
    params,
    body,
    status,
    duration,
    response
  }) => {
    try {
      setShowBot(true);

      const previousAttempts = history
        .filter((h) => {
          try {
            const u1 = new URL(h.url);
            const u2 = new URL(url);
            const clean1 = u1.pathname.toLowerCase().replace(/[^a-z0-9]/g, "");
            const clean2 = u2.pathname.toLowerCase().replace(/[^a-z0-9]/g, "");
            return u1.host === u2.host && (clean1.includes(clean2.slice(0, 4)) || clean2.includes(clean1.slice(0, 4)));
          } catch {
            return h.url?.includes(url.slice(0, 15)) || false;
          }
        })
        .slice(0, 5);

      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("authToken");
      const currentUserId = localStorage.getItem("userId") || getUserIdFromToken() || "guest";

      const assistPayload = {
        userId: currentUserId,
        method,
        url,
        headers,
        params,
        body,
        status: status || 500,
        duration,
        response: typeof response === "object" ? response : { message: String(response) },
        previousAttempts
      };

      const res = await authenticatedFetch(`${backendUrl}/api/ai/failure-assist`, {
        method: "POST",
        body: JSON.stringify(assistPayload)
      });

      const data = await res.json();
      if (data.diagnosis) {
        setMessages((prev) => [
          ...prev,
          {
            from: "bot",
            type: "failure_assist",
            status: status || 500,
            diagnosis: data.diagnosis,
            retrievedEpisodes: data.retrievedEpisodes || []
          }
        ]);
      }
    } catch (err) {
      console.error("Auto failure assistant trigger failed:", err);
    }
  };


  // -------------------------------------------
  // SEND REQUEST (V1 + V2 EVENT-DRIVEN FLOW)
  // -------------------------------------------
  const handleSend = async () => {
    setErrorMsg("");
    setResponse("");
    setStatus(null);

    const token = localStorage.getItem("authToken");
    if (!token) {
      setErrorMsg("You must be logged in to send requests.");
      return;
    }

    if (!url.trim()) {
      setErrorMsg("Please enter a URL.");
      return;
    }

    if (!isValidUrl(url)) {
      setErrorMsg("Invalid URL format.");
      return;
    }

    const headers = {};
    headersObj.forEach(h => {
      if (h.key) headers[h.key] = h.value;
    });

    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";

    if (auth.type === "bearer" && auth.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }

    if (auth.type === "basic" && auth.username && auth.password) {
      const encoded = btoa(`${auth.username}:${auth.password}`);
      headers["Authorization"] = `Basic ${encoded}`;
    }

    setLoading(true);
    const start = performance.now();

    try {
      let bodyPayload = null;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        if (bodyType === "raw" && rawBody?.trim()) {
          try {
            bodyPayload = JSON.parse(rawBody);
          } catch (err) {
            setErrorMsg("Invalid JSON in body: " + err.message);
            setLoading(false);
            return;
          }
        } else if (bodyType === "form-data") {
          const formObj = {};
          formDataList.forEach(item => {
            if (item.key?.trim()) {
              formObj[item.key.trim()] = item.value;
            }
          });
          bodyPayload = formObj;
          if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        } else if (bodyType === "x-www-form-urlencoded") {
          const urlEncodedObj = {};
          urlencodedList.forEach(item => {
            if (item.key?.trim()) {
              urlEncodedObj[item.key.trim()] = item.value;
            }
          });
          bodyPayload = urlEncodedObj;
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
      }

      const finalUrl = url.trim();
      const backendUrl = process.env.REACT_APP_BACKEND_URL;

      const res = await authenticatedFetch(`${backendUrl}/api/request`, {
        method: "POST",
        body: JSON.stringify({
          url: finalUrl,
          method,
          headers: headers,
          body: bodyPayload,
          appliedFix: appliedFixInfo,
        }),
      });

      const data = await res.json();
      const duration = Math.round(performance.now() - start);

      if (!data.success) {
        const errorText = data.message || data.error || (res.status === 401 ? "Session expired. Please log in again." : "Request failed.");
        setErrorMsg(errorText);
        setStatus(res.status === 401 ? 401 : "ERR");
        setResponse({ error: errorText });

        if (res.status === 401) {
          showToast("⚠️ Your login session has expired. Please log in again.");
        }

        // V2: Auto-trigger failure workflow on proxy execution error
        triggerAutoFailureAssistant({
          method,
          url: finalUrl,
          headers,
          params: paramsObj,
          body: bodyPayload,
          status: res.status === 401 ? 401 : "ERR",
          duration,
          response: { error: errorText }
        });
        return;
      }

      const respBody = data.body ?? data.result ?? data;
      const currentUserId = localStorage.getItem("currentUserId");
      if (currentUserId) {
        const savedCount = localStorage.getItem(`requestCount_${currentUserId}`);
        const total = (savedCount ? parseInt(savedCount) : 0) + 1;
        localStorage.setItem(`requestCount_${currentUserId}`, total);
      }

      const statusCode = data.status ?? res.status ?? "OK";
      setResponse(respBody);
      setLastResponse(respBody);
      setLastRequest({ url, method, body: bodyPayload, status: statusCode });
      sessionStorage.setItem("lastResponse", JSON.stringify(respBody));
      sessionStorage.setItem(
        "lastRequest",
        JSON.stringify({ url, method, body: bodyPayload, status: statusCode })
      );

      setStatus(statusCode);

      setApiContext({
        method,
        url: finalUrl,
        headers,
        status: statusCode,
        responseTime: duration,
        response: respBody || { error: "No response body available" }
      });

      // Update history capsule
      const newHistoryItem = {
        _id: data.historyId || "temp-" + Date.now(),
        method,
        url: finalUrl,
        status: statusCode,
        duration,
        headers,
        params: paramsObj,
        requestBody: bodyPayload,
        responseBody: respBody,
        appliedFix: appliedFixInfo,
        time: new Date().toISOString()
      };

      setHistory(prev => [newHistoryItem, ...prev]);

      // 🔹 V2: AUTOMATIC FAILURE ASSISTANT TRIGGER (4xx, 5xx, or ERR)
      const isFailure =
        String(statusCode).startsWith("4") ||
        String(statusCode).startsWith("5") ||
        String(statusCode) === "ERR";

      if (isFailure) {
        triggerAutoFailureAssistant({
          method,
          url: finalUrl,
          headers,
          params: paramsObj,
          body: bodyPayload,
          status: statusCode,
          duration,
          response: respBody
        });
      } else {
        // 🔹 V2 RAG: Index verified resolution episode into RAG memory if an auto-fix was resolved
        if (appliedFixInfo) {
          const backendUrl = process.env.REACT_APP_BACKEND_URL;
          const userIdentifier = localStorage.getItem("userId") || getUserIdFromToken() || "guest";

          authenticatedFetch(`${backendUrl}/api/ai/rag/index-episode`, {
            method: "POST",
            body: JSON.stringify({
              userId: userIdentifier,
              method,
              url: finalUrl,
              failedStatus: appliedFixInfo.originalStatus || 401,
              errorSnippet: appliedFixInfo.errorSnippet || "Failure resolved via confirmed auto-fix",
              rootCauseLayer: appliedFixInfo.rootCauseLayer || "General",
              appliedFix: appliedFixInfo,
              successStatus: statusCode,
              successDuration: duration
            })
          })
            .then(() => {
              showToast("🧠 Resolution episode indexed into RAG memory!");
            })
            .catch((err) => {
              console.error("Failed to index RAG resolution episode:", err);
            });

          setAppliedFixInfo(null);
        }
      }

    } catch (err) {
      console.error("Request failed:", err);
      setErrorMsg("Request failed: " + err.message);
      setStatus("ERR");
      setResponse({ error: err.message });

      // V2: Auto-trigger failure workflow on catch exception
      triggerAutoFailureAssistant({
        method,
        url,
        headers,
        params: paramsObj,
        body: rawBody,
        status: "ERR",
        duration: 0,
        response: { error: err.message }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryDelete = async (historyId) => {
    try {
      setHistory(prev => prev.filter(item => item._id !== historyId));
      showToast("🗑️ History item deleted!");

      deleteHistoryItem(historyId).catch((err) => {
        console.error("Failed to delete history item:", err);
        loadUserHistory();
      });
    } catch (err) {
      console.error("Failed to delete history item:", err);
      loadUserHistory();
    }
  };

  const handleHistoryClear = async () => {
    try {
      setHistory([]);
      showToast("🧹 All history cleared!");

      clearHistory().catch((err) => {
        console.error("Failed to clear history:", err);
        loadUserHistory();
      });
    } catch (err) {
      console.error("Failed to clear history:", err);
      loadUserHistory();
    }
  };

  const handleHistorySelect = (item) => {
    const fullUrlString = item.url || "";
    setMethod(item.method || "GET");
    setResponse("");
    setStatus(item.status ?? null);

    if (item.headers && typeof item.headers === "object") {
      const hdrs = Object.entries(item.headers).map(([key, value]) => ({
        key,
        value: String(value),
        description: ""
      }));
      hdrs.push({ key: "", value: "", description: "" });
      setHeadersObj(hdrs);
    }

    if (item.requestBody) {
      setRawBody(typeof item.requestBody === "object" ? JSON.stringify(item.requestBody, null, 2) : String(item.requestBody));
    }

    if (!fullUrlString) {
      setUrl("");
      setParamsObj([{ key: "", value: "", description: "" }]);
      return;
    }

    try {
      setUrl(fullUrlString);

      if (fullUrlString.includes("?")) {
        const queryPart = fullUrlString.substring(fullUrlString.indexOf("?") + 1);
        const searchParams = new URLSearchParams(queryPart);
        const newParams = [];
        searchParams.forEach((val, key) => {
          newParams.push({ key, value: val, description: "" });
        });
        newParams.push({ key: "", value: "", description: "" });
        setParamsObj(newParams);
      } else {
        setParamsObj([{ key: "", value: "", description: "" }]);
      }
    } catch (e) {
      setUrl(fullUrlString);
      setParamsObj([{ key: "", value: "", description: "" }]);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(typeof text === "string" ? text : JSON.stringify(text, null, 2));
    showToast("✅ Copied to clipboard!");
  };

  // Open Timeline Modal
  const handleOpenTimeline = (targetUrl) => {
    setTimelineTargetUrl(targetUrl || url);
    setShowTimelineModal(true);
  };

  // Open Compare Modal
  const handleOpenCompare = (attemptA, attemptB) => {
    setCompareAttemptA(attemptA || history[0] || null);
    setCompareAttemptB(attemptB || history[1] || history[0] || null);
    setShowCompareModal(true);
  };


  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar-small">
        <button 
          className="sidebar-btn" 
          onClick={() => {
            const token = localStorage.getItem("authToken");
            if (!token) {
              navigate("/login");
            } else {
              navigate("/account");
            }
          }}
        >
          👤<span className="tooltip">Account</span>
        </button>

        <button
          className={`sidebar-btn ${activePanel === "history" ? "active" : ""}`}
          onClick={() => {
            const token = localStorage.getItem("authToken");
            if (!token) {
              showToast("⚠️ You need to log in to see your history.");
              return;
            }
            setActivePanel(activePanel === "history" ? null : "history");
          }}
        >
          🕒<span className="tooltip">History</span>
        </button>

        <button
          className={`sidebar-btn ${activePanel === "flows" ? "active" : ""}`}
          onClick={() => setActivePanel(activePanel === "flows" ? null : "flows")}
        >
          🔀<span className="tooltip">Flows</span>
        </button>
      </div>

      <div className="sidebar-large" style={{ display: activePanel === "history" ? "block" : "none" }}>
        <HistorySidebar
          items={history}
          onSelect={handleHistorySelect}
          onDelete={handleHistoryDelete}
          onClear={handleHistoryClear}
          onOpenTimeline={handleOpenTimeline}
          onOpenCompare={handleOpenCompare}
        />
      </div>

      {activePanel === "flows" && (
        <div className="sidebar-large">
          <FlowsSidebar
            refreshKey={flowsRefreshKey}
            onOpenStudio={(flow) => setFlowStudioModal({ flow, initialMode: "builder" })}
            onRunFlow={(flow) => setFlowStudioModal({ flow, initialMode: "runner" })}
          />
        </div>
      )}

      {activePanel === "account" && (
        <div className="sidebar-large">
          <Suspense fallback={<div style={{ padding: "20px", color: "#888" }}>Loading Account...</div>}>
            <AccountPage onClose={() => setActivePanel(null)} />
          </Suspense>
        </div>
      )}

      {/* Main App Area */}
      <div className="app">
        <form
          className="top-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <MethodDropdown method={method} setMethod={setMethod} />

          <RequestBar
            url={url}
            setUrl={setUrl}
            paramsObj={paramsObj}
            setParamsObj={setParamsObj}
          />

          <button
            type="submit"
            className="send-btn"
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        {/* Tabs */}
        <div className="tab-list">
          {["Params", "Headers", "Body", "Authorization", "Settings"].map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                if (tab === "Settings") {
                  const token = localStorage.getItem("authToken");
                  if (!token) {
                    navigate("/login");
                  } else {
                    navigate("/account");
                  }
                } else {
                  setActiveTab(tab);
                }
              }}
            >
              {tab === "Authorization" ? (
                <>
                  <span className="tab-label-desktop">Authorization</span>
                  <span className="tab-label-mobile">Auth</span>
                </>
              ) : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          <div className="request-area">
            {activeTab === "Params" && (
              <ParamsTab
                paramsObj={paramsObj}
                setParamsObj={(updated) => setParamsObj(cleanParams(updated))}
                url={url}
                setUrl={setUrl}
              />
            )}

            {activeTab === "Headers" && (
              <HeadersTab 
                headers={headersObj} 
                setHeaders={(updated) => setHeadersObj(cleanHeaders(updated))} 
              />
            )}
            {activeTab === "Body" && (
              <BodyTab
                bodyType={bodyType}
                setBodyType={setBodyType}
                body={rawBody}
                setBody={setRawBody}
                onBodyChange={(val) => setRawBody(val)}
                formData={formDataList}
                setFormData={setFormDataList}
                urlencoded={urlencodedList}
                setUrlencoded={setUrlencodedList}
              />
            )}
            {activeTab === "Authorization" && (
              <AuthorizationTab auth={auth} setAuth={setAuth} />
            )}
            {activeTab === "Settings" && <div>Settings options</div>}
          </div>
        </div>

        {/* Response Section */}
        <div className="response" ref={responseRef} style={{ height: responseHeight }}>
          <div 
            className="response-resize-handle" 
            onMouseDown={startResizing}
            onTouchStart={startResizing}
          ></div>
          <div className="response-header">
            <div className="response-left">
              <h4>Response</h4>
              <div className="view-buttons">
                {["pretty", "raw", "preview"].map((mode) => (
                  <button
                    key={mode}
                    className={`view-btn ${viewMode === mode ? "active" : ""}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
                <button
                  className="save-btn"
                  onClick={() => {
                    if (!response) {
                      showToast("⚠️ First send a request and then you can save it.");
                      return;
                    }
                    const blob = new Blob(
                      [typeof response === "string" ? response : JSON.stringify(response, null, 2)],
                      { type: "application/json" }
                    );
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "response.json";
                    link.click();
                    showToast("💾 Response saved successfully!");
                  }}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="response-right" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* V2: Timeline Button */}
              {history.length > 0 && (
                <button
                  type="button"
                  className="v2-tool-pill-btn"
                  onClick={() => handleOpenTimeline(url)}
                  title="Open Testing Timeline"
                >
                  🧬 Timeline
                </button>
              )}

              {/* V2: Compare Button */}
              {history.length >= 2 && (
                <button
                  type="button"
                  className="v2-tool-pill-btn"
                  onClick={() => handleOpenCompare(history[1], history[0])}
                  title="Compare History Capsules"
                >
                  ⚖️ Compare
                </button>
              )}

              {status !== null && <span className={`status-badge status-${status}`}>{status}</span>}

              <button className="copy-btn" onClick={() => response && copyToClipboard(response)}>Copy</button>
              <button
                type="button"
                className="help-bot-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const token = localStorage.getItem("authToken");
                  if (!token) {
                    showToast("⚠️ Please log in to use the AI Assistant.");
                    navigate("/login");
                    return;
                  }
                  if (!response) {
                    showToast("⚠️ Please send a request first to get help!");
                    return;
                  }
                  setShowBot(true);
                }}
              >
                Help
              </button>
            </div>
          </div>

          <div className="response-body" style={{ overflow: "auto", maxHeight: "585px" }}>
            {loading ? (
              <div style={{ padding: "20px", color: "#888", display: "flex", alignItems: "center", gap: "10px" }}>
                <span>⏳ Waiting for response...</span>
              </div>
            ) : !response ? (
              <p>No response yet</p>
            ) : (
              <>
                <div style={{ display: viewMode === "raw" ? "block" : "none" }}>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, padding: "10px" }}>
                    {(() => {
                      const str = typeof response === "string" ? response : JSON.stringify(response);
                      return str.length > 250000 ? str.slice(0, 250000) + "\n\n... [Truncated for performance]" : str;
                    })()}
                  </pre>
                </div>

                <div className="pretty-json-container" style={{ display: viewMode === "pretty" ? "block" : "none", maxWidth: "100%", overflowX: "auto" }}>
                  {(() => {
                    try {
                      const isTooLarge = typeof response !== "string" && JSON.stringify(response).length > 250000;
                      if (isTooLarge) {
                        return (
                          <div style={{ padding: "20px", color: "var(--terminal-text-dim)" }}>
                            ⚠️ This response is too large to safely render in 'Pretty' mode. Please use 'Raw' or 'Preview'.
                          </div>
                        );
                      }
                      return (
                        <ReactJson
                          src={typeof response === "string" ? { raw: response } : response}
                          name={null}
                          collapsed={50}
                          enableClipboard={true}
                          displayDataTypes={false}
                          displayObjectSize={true}
                          theme="google"
                          style={{ fontSize: "12px", background: "transparent" }}
                        />
                      );
                    } catch (err) {
                      return <div style={{ color: "var(--terminal-red)", padding: "10px" }}>Error rendering pretty view. Try 'Raw'.</div>;
                    }
                  })()}
                </div>

                <div style={{ display: viewMode === "preview" ? "block" : "none", background: "transparent", color: "var(--terminal-white)", overflowX: "auto", padding: "10px" }}>
                  <pre style={{ margin: 0, color: "var(--terminal-white)", whiteSpace: "pre" }}>
                    {typeof response === "string" ? response.replace(/\\n/g, "\n") : JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lazy Suspense Modal Container */}
      <Suspense fallback={null}>
        {/* AI Bot Sidebar with Diagnostics & Suggestions */}
        {showBot && (
          <BotSidebar
            onClose={() => setShowBot(false)}
            currentApiContext={apiContext}
            setShowBot={setShowBot}
          />
        )}


        {/* V2: Testing Timeline Modal */}
        {showTimelineModal && (
          <TestingTimelineModal
            currentEndpoint={timelineTargetUrl || url}
            historyItems={history}
            onClose={() => setShowTimelineModal(false)}
            onRestoreAttempt={handleHistorySelect}
            onOpenCompare={(a, b) => {
              setShowTimelineModal(false);
              handleOpenCompare(a, b);
            }}
          />
        )}

        {/* V2: History Capsule Comparison Modal */}
        {showCompareModal && (
          <HistoryComparisonModal
            attemptA={compareAttemptA}
            attemptB={compareAttemptB}
            allHistory={history}
            onClose={() => setShowCompareModal(false)}
          />
        )}

        {/* V2.1: Multi-Step Flow Studio & Autonomous Self-Healing Runner */}
        {flowStudioModal && (
          <FlowStudioModal
            flow={flowStudioModal.flow}
            initialMode={flowStudioModal.initialMode || "builder"}
            onClose={() => setFlowStudioModal(null)}
            onSaved={(savedFlow) => {
              setFlowsRefreshKey(prev => prev + 1);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
