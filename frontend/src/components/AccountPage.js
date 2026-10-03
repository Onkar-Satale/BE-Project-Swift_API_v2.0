// frontend/src/pages/AccountPage.jsx
import "./accountPage.css";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useContext, useRef } from "react";
import { getToken, logout, authenticatedFetch } from "../services/authService";
import { showToast } from "../utils/toast";
import { SwiftAPIContext } from "../context/SwiftAPIContext";

// GRID CONFIGURATION
const GRID_ROWS = 22;
const GRID_COLS = 10;
const ROW_START_COLS = [
  2, 1, 3, 2, 4, 1, 3, 2, 1, 4,
  2, 1, 3, 2, 4, 1, 3, 2, 1, 4,
  2, 1
];

function GridBlock() {
  const [isActive, setIsActive] = useState(false);
  const [pixels, setPixels] = useState([]);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    setIsActive(true);
    // Generate a random 4x4 grid of pixel colors
    const newPixels = Array.from({ length: 16 }, () => {
      const rand = Math.random();
      if (rand < 0.5) return "purple";
      if (rand < 0.65) return "white";
      if (rand < 0.8) return "pink";
      if (rand < 0.9) return "green";
      return "empty";
    });
    setPixels(newPixels);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Stay active for 1.2s then fade back to empty
    timerRef.current = setTimeout(() => {
      setIsActive(false);
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`grid-block ${isActive ? "active" : ""}`}
      onMouseEnter={handleMouseEnter}
    >
      <div className="pixel-container">
        {pixels.map((color, idx) => (
          <div key={idx} className={`pixel ${color}`} />
        ))}
      </div>
    </div>
  );
}

function RenderGrid() {
  const blocks = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const isVisible = c >= ROW_START_COLS[r];
      blocks.push(
        <div key={`${r}-${c}`} className={`grid-cell-wrapper ${isVisible ? "visible-cell" : "empty-cell"}`}>
          {isVisible ? <GridBlock /> : <div className="grid-cell-empty" />}
        </div>
      );
    }
  }

  return (
    <div className="render-grid-container">
      {blocks}
    </div>
  );
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg] = useState("");
  const [isGuest] = useState(false);
  const [requestsCount, setRequestsCount] = useState(0); // local state for per-user count

  const capitalizeFirstChar = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Load user info from local storage (aligned with PackMate style)
  const fetchUser = () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      navigate("/login");
      return;
    }

    const username = localStorage.getItem("username");
    const email = localStorage.getItem("email");
    const createdAt = localStorage.getItem("createdAt");

    if (username && email) {
      setUser({ username, email, createdAt });
    } else {
      setUser({ username: "User", email: "N/A", createdAt: new Date() });
    }
    setLoading(false);
  };

  // Fetch user history for stats
  const fetchHistory = async () => {
    if (!getToken()) return; // guest users have no backend history
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const res = await authenticatedFetch(`${backendUrl}/api/history`);
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
      } else {
        console.error("Failed to fetch history:", data);
      }
    } catch (err) {
      console.error("History fetch error:", err.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const res = await authenticatedFetch(`${backendUrl}/api/delete-account`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowDeleteConfirm(false);
        // Do NOT show toast on account deletion as requested
        setTimeout(() => {
          logout();
          navigate("/");
        }, 100);
      } else {
        console.error("Failed to delete account");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const { resetContext } = useContext(SwiftAPIContext);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    showToast("🚪 Successfully logged out.");
    resetContext();
    logout();
    navigate("/");
  };

  const openDocumentation = () => {
    navigate("/documentation"); // navigate to Documentation page
  };

  const contactSupport = () => {
    navigate("/contact-support"); // navigate to Contact Support page
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Removed redundant fetchRequestCount

  useEffect(() => {
    if (user) {
      fetchHistory();
      // Set the requests count based entirely on history length so it syncs with deletions
      setRequestsCount(history.length);
    }
  }, [user, history.length]);

  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!user) return;
    const lines = [
      `[${new Date().toLocaleTimeString()}] INCOMING REQUEST: GET /api/user/profile ...`,
      `[${new Date().toLocaleTimeString()}] RESOLVING SESSION TOKEN ... SUCCESS`,
      `[${new Date().toLocaleTimeString()}] INJECTING ACCOUNT VARIABLES ...`,
      `[${new Date().toLocaleTimeString()}] DATABASE CONNECTION ... ACTIVE`,
      `[${new Date().toLocaleTimeString()}] PROFILE RETRIEVED FOR USER "${user.username.toUpperCase()}"`,
      `[${new Date().toLocaleTimeString()}] SYSTEM STATUS ... SECURE & STABLE`
    ];
    setLogs([]);
    let current = 0;
    const timer = setInterval(() => {
      if (current < lines.length) {
        setLogs(prev => [...prev, lines[current]]);
        current++;
      } else {
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [user]);

  if (loading) return <div className="terminal-loading">Loading user data from terminal...</div>;
  if (errorMsg) return <div className="terminal-error">ERROR: {errorMsg}</div>;

  // Stats: dynamic if user logged in, else 0
  const collectionsCount = user?.collections?.length || 0;
  const workspacesCount = user?.workspaces?.length || 0;

  return (
    <div className="account-page">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal terminal-modal">
            <div className="modal-title">⚠️ WARNING: ACCOUNT DELETION</div>
            <div className="modal-body-text">
              Do you really want to delete this account? This will permanently erase your profile and all related history data.
            </div>
            <div className="modal-actions">
              <button className="btn-no" onClick={() => setShowDeleteConfirm(false)}>[ NO, CANCEL ]</button>
              <button className="btn-yes" onClick={handleDeleteAccount}>[ YES, DELETE ]</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal terminal-modal">
            <div className="modal-title">⚠️ ALERT: SECURE LOGOUT</div>
            <div className="modal-body-text">
              Do you really want to logout from this terminal?
            </div>
            <div className="modal-actions">
              <button className="btn-no" onClick={() => setShowLogoutConfirm(false)}>[ NO, CANCEL ]</button>
              <button className="btn-yes" onClick={handleLogout}>[ YES, LOGOUT ]</button>
            </div>
          </div>
        </div>
      )}

      {/* Main split-screen container */}
      <div className="terminal-grid-layout">
        
        {/* Left Side: Terminal Console */}
        <div className="terminal-console-section">
          {/* Header */}
          <header className="terminal-header">
            <div className="terminal-logo">
              <span className="logo-symbol">❤</span> SWIFT API
            </div>
            <div className="header-actions">
              <button onClick={() => navigate("/")} className="back-btn">
                [ BACK TO APP ]
              </button>
              {!isGuest && (
                <>
                  <button onClick={() => setShowDeleteConfirm(true)} className="delete-account-btn">
                    [ DELETE ACCOUNT ]
                  </button>
                  <button onClick={() => setShowLogoutConfirm(true)} className="logout-btn">
                    [ LOGOUT ]
                  </button>
                </>
              )}
            </div>
          </header>

          <div className="terminal-body">
            {/* Logs Area */}
            <div className="terminal-logs-window">
              {logs.map((log, idx) => (
                <div key={idx} className="log-line">{log}</div>
              ))}
              {logs.length === 6 && (
                <>
                  <div className="log-line welcome-ascii">
{`┌───────────────────────────────────────────────┐
│          SWIFT API // USER ACCOUNT            │
└───────────────────────────────────────────────┘`}
                  </div>
                  <div className="log-line welcome-msg" style={{ color: "var(--terminal-white)", fontWeight: "bold", marginTop: 8 }}>
                    WELCOME, {user?.username?.toUpperCase()}!
                  </div>
                </>
              )}
            </div>

            {/* User details formatted as terminal stats/info blocks */}
            {logs.length === 6 && (
              <div className="terminal-account-info">
                
                {/* Profile Information */}
                <div className="terminal-section-block">
                  <div className="section-title">{"// USER PROFILE DATA"}</div>
                  <div className="info-row">
                    <span className="info-key">USERNAME:</span>
                    <span className="info-value">{user?.username ? capitalizeFirstChar(user.username) : "Guest"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">EMAIL_ADDR:</span>
                    <span className="info-value">{user?.email || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">MEMBER_SINCE:</span>
                    <span className="info-value">
                      {(() => {
                        if (!user || !user.createdAt || user.createdAt === "null" || user.createdAt === "undefined") return "N/A";
                        const date = new Date(user.createdAt);
                        return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
                      })()}
                    </span>
                  </div>
                </div>

                {/* Preferences */}
                <div className="terminal-section-block">
                  <div className="section-title">{"// PREFERENCES"}</div>
                  <div className="info-row">
                    <span className="info-key">THEME_MODE:</span>
                    <span className="info-value">DARK_CONSOLE</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">LANGUAGE:</span>
                    <span className="info-value">ENGLISH_US</span>
                  </div>
                  <div className="action-row">
                    <button
                      className="terminal-action-btn edit-btn"
                      disabled={isGuest}
                      onClick={() => !isGuest && showToast("✏️ Preferences editing is currently read-only.")}
                      title={isGuest ? "Login to edit preferences" : ""}
                    >
                      [ EDIT PREFERENCES ]
                    </button>
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="terminal-section-block">
                  <div className="section-title">{"// USAGE STATISTICS"}</div>
                  <div className="info-row">
                    <span className="info-key">REQUESTS_SENT:</span>
                    <span className="info-value highlight-num">{requestsCount}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">COLLECTIONS:</span>
                    <span className="info-value highlight-num">{collectionsCount}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">WORKSPACES:</span>
                    <span className="info-value highlight-num">{workspacesCount}</span>
                  </div>
                </div>

                {/* Workspaces */}
                <div className="terminal-section-block">
                  <div className="section-title">{"// ACTIVE WORKSPACES"}</div>
                  <ul className="workspace-list">
                    {user?.workspaces?.map((ws, idx) => (
                      <li key={idx}>* {ws}</li>
                    )) || <li>* Personal Workspace</li>}
                  </ul>
                  <div className="action-row">
                    <button
                      className="terminal-action-btn create-btn"
                      disabled={isGuest}
                      onClick={() => !isGuest && showToast("➕ Workspaces management is available in the main app.")}
                      title={isGuest ? "Login to create workspace" : ""}
                    >
                      [ CREATE NEW WORKSPACE ]
                    </button>
                  </div>
                </div>

                {/* Help and Support */}
                <div className="terminal-section-block">
                  <div className="section-title">{"// SYSTEM RESOURCES & HELP"}</div>
                  <div className="info-row">
                    <span className="info-key">DOCUMENTATION:</span>
                    <span className="info-value">
                      <button className="terminal-link-btn" onClick={openDocumentation}>
                        [ VIEW DOCS ]
                      </button>
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">CONTACT_SUPPORT:</span>
                    <span className="info-value">
                      <button className="terminal-link-btn" onClick={contactSupport}>
                        [ GET SUPPORT ]
                      </button>
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="terminal-footer">
            <span
              className="terminal-purple-link"
              onClick={() => navigate("/")}
              style={{ cursor: "pointer" }}
            >
              START TESTING ON SWIFT API TODAY →
            </span>
            <span className="terminal-status-light">APPLICATION RUNNING</span>
          </div>
        </div>

        {/* Right Side: Render-style blocks animation */}
        <div className="grid-animation-section">
          <RenderGrid />
        </div>

      </div>
    </div>
  );
}



































