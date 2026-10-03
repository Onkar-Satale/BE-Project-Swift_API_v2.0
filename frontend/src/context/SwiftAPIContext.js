import { createContext, useState, useEffect } from "react";

export const SwiftAPIContext = createContext();

export const SwiftAPIProvider = ({ children }) => {
  // Load initial state from sessionStorage safely
  const getInitialState = () => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem("swiftApiState")) || {};
      if (parsed.url && (parsed.url.includes("?url=") || parsed.url.includes("&url="))) {
        parsed.url = parsed.url.split("?")[0];
      }
      if (Array.isArray(parsed.paramsObj)) {
        parsed.paramsObj = parsed.paramsObj.filter(p => p.key !== "url");
        if (parsed.paramsObj.length === 0) {
          parsed.paramsObj = [{ key: "", value: "", description: "" }];
        }
      }
      return parsed;
    } catch {
      return {};
    }
  };
  const saved = getInitialState();

  // Core API request state
  const [method, setMethod] = useState(saved.method || "GET");
  const [url, setUrl] = useState(saved.url || "");
  const [headersObj, setHeadersObj] = useState(saved.headersObj || [{ key: "", value: "" }]);
  const [paramsObj, setParamsObj] = useState(saved.paramsObj || [{ key: "", value: "", description: "" }]);
  const [rawBody, setRawBody] = useState(saved.rawBody || "");
  const [activeTab, setActiveTab] = useState(saved.activeTab || "Params");

  // Authorization state
  const [auth, setAuth] = useState(saved.auth || {
    type: "none",
    token: "",
    username: "",
    password: "",
  });

  // Response + Bot state
  const [response, setResponse] = useState(saved.response || "");
  const [status, setStatus] = useState(saved.status || null);
  const [messages, setMessages] = useState(saved.messages || [
    { from: "bot", text: "Hi 👋 I’m your J.A.R.V.I.S. API assistant! You can ask me questions about API testing, HTTP protocols, headers, status codes, or request structures. ⚠️ Please note that I only answer questions related to API testing and development." }
  ]);

  // V2: applied fix state
  const [appliedFixInfo, setAppliedFixInfo] = useState(null);

  // Persist to sessionStorage whenever state changes
  useEffect(() => {
    const stateToSave = {
      method, url, headersObj, paramsObj, rawBody, activeTab,
      auth,
      response, status, messages
    };
    sessionStorage.setItem("swiftApiState", JSON.stringify(stateToSave));
  }, [method, url, headersObj, paramsObj, rawBody, activeTab, auth, response, status, messages]);

  // Reset Context for logout or new login
  const resetContext = () => {
    setMethod("GET");
    setUrl("");
    setHeadersObj([{ key: "", value: "" }]);
    setParamsObj([{ key: "", value: "", description: "" }]);
    setRawBody("");
    setActiveTab("Params");
    setAuth({
      type: "none",
      token: "",
      username: "",
      password: "",
    });
    setResponse("");
    setStatus(null);
    setAppliedFixInfo(null);
    setMessages([
      { from: "bot", text: "Hi 👋 I’m your J.A.R.V.I.S. API assistant! You can ask me questions about API testing, HTTP protocols, headers, status codes, or request structures. ⚠️ Please note that I only answer questions related to API testing and development." }
    ]);
  };

  return (
    <SwiftAPIContext.Provider
      value={{
        method, setMethod,
        url, setUrl,
        headersObj, setHeadersObj,
        paramsObj, setParamsObj,
        rawBody, setRawBody,
        activeTab, setActiveTab,
        auth, setAuth,
        response, setResponse,
        status, setStatus,
        messages, setMessages,
        appliedFixInfo, setAppliedFixInfo,
        resetContext
      }}
    >
      {children}
    </SwiftAPIContext.Provider>
  );
};
