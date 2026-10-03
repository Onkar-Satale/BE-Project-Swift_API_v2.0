const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Signup user with cookie support
export const signup = async ({ firstName, lastName, email, password }) => {
  const res = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ firstName, lastName, email, password }),
  });
  return res.json();
};

// Login user with cookie support
export const login = async ({ email, password }) => {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

// Automatically refresh access token using HTTP-only cookie
export const refreshAccessToken = async () => {
  try {
    const res = await fetch(`${API_URL}/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem("authToken", data.token);
      if (data.userId) {
        localStorage.setItem("userId", data.userId);
      }
      return data.token;
    }
    return null;
  } catch (err) {
    console.error("Token refresh failed:", err);
    return null;
  }
};

// Universal Authenticated Fetch with Automatic Silent Token Refresh on 401
export const authenticatedFetch = async (url, options = {}) => {
  let token = localStorage.getItem("authToken");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // If 401 Unauthorized, automatically attempt silent token refresh and retry
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
    }
  }

  return res;
};

// Save auth token and userId along with profile details
export const saveAuthData = ({ token, email, firstName, lastName, createdAt }) => {
  localStorage.setItem("authToken", token);
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.userId || payload.id || payload._id;
    if (userId) {
      localStorage.setItem("userId", userId);
    }
  } catch (e) {}
  const fullName = lastName ? `${firstName} ${lastName}`.trim() : (firstName || "");
  localStorage.setItem("username", fullName);
  localStorage.setItem("email", email || "");
  if (createdAt) {
    localStorage.setItem("createdAt", createdAt);
  }
};

// Get token
export const getToken = () => localStorage.getItem("authToken");

// Get userId
export const getUserId = () => localStorage.getItem("userId");

// Logout
export const logout = () => {
  fetch(`${API_URL}/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  
  localStorage.removeItem("authToken");
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("createdAt");
  sessionStorage.removeItem("swiftApiState");
  sessionStorage.removeItem("postmanCloneState");
  sessionStorage.removeItem("lastRequest");
  sessionStorage.removeItem("lastResponse");
  sessionStorage.removeItem("activePanel");
  sessionStorage.removeItem("showBot");
};
