import React, { useState, useRef, useEffect } from "react";
import "./AuthorizationTab.css";

const AuthorizationTab = ({ auth, setAuth }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleTypeSelect = (typeValue) => {
    setAuth({
      type: typeValue,
      token: "",
      username: "",
      password: "",
    });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="auth-tab">
      {/* Auth type selector */}
      <div className="auth-row">
        <label className="auth-label">Type</label>
        <div className="auth-dropdown-container" ref={dropdownRef}>
          <div
            className="auth-select-display"
            onClick={() => setOpen(!open)}
          >
            {auth.type === "bearer"
              ? "Bearer Token"
              : auth.type === "basic"
              ? "Basic Auth"
              : "No Auth"}
            <span className="auth-dropdown-arrow">▼</span>
          </div>

          {open && (
            <div className="auth-dropdown-menu">
              <div
                className={`auth-dropdown-item ${
                  auth.type === "none" || auth.type === "none" ? "selected" : ""
                }`}
                onClick={() => {
                  handleTypeSelect("none");
                  setOpen(false);
                }}
              >
                No Auth
              </div>
              <div
                className={`auth-dropdown-item ${
                  auth.type === "bearer" ? "selected" : ""
                }`}
                onClick={() => {
                  handleTypeSelect("bearer");
                  setOpen(false);
                }}
              >
                Bearer Token
              </div>
              <div
                className={`auth-dropdown-item ${
                  auth.type === "basic" ? "selected" : ""
                }`}
                onClick={() => {
                  handleTypeSelect("basic");
                  setOpen(false);
                }}
              >
                Basic Auth
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bearer Token */}
      {auth.type === "bearer" && (
        <div className="auth-row">
          <label className="auth-label">Token</label>
          <input
            type="text"
            className="auth-input"
            placeholder="Enter bearer token"
            value={auth.token}
            onChange={(e) =>
              setAuth({ ...auth, token: e.target.value })
            }
          />
        </div>
      )}

      {/* Basic Auth */}
      {auth.type === "basic" && (
        <>
          <div className="auth-row">
            <label className="auth-label">Username</label>
            <input
              type="text"
              className="auth-input"
              placeholder="Username"
              value={auth.username}
              onChange={(e) =>
                setAuth({ ...auth, username: e.target.value })
              }
            />
          </div>

          <div className="auth-row">
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={auth.password}
              onChange={(e) =>
                setAuth({ ...auth, password: e.target.value })
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AuthorizationTab;
