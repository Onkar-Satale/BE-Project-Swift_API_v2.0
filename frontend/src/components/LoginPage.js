import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SwiftAPIContext } from "../context/SwiftAPIContext";
import { login, saveAuthData } from "../services/authService";
import { showToast } from "../utils/toast";
import "./Login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { resetContext } = useContext(SwiftAPIContext);

  useEffect(() => {
    // Clear context immediately when they navigate to login
    resetContext();
    const token = localStorage.getItem("authToken");
    if (token) navigate("/");
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await login(formData);

      if (res.success && res.data && res.data.token) {
        saveAuthData(res.data);
        showToast("🔓 Logged in successfully!");
        navigate("/");
      } else {
        setErrorMsg("Invalid credentials");
      }
    } catch (err) {
      setErrorMsg("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        <label>Password</label>
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <input 
            type={showPassword ? "text" : "password"} 
            name="password" 
            value={formData.password} 
            onChange={handleChange} 
            required 
            style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box", margin: "0" }}
          />
          <span 
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex", alignItems: "center", color: "#666", margin: "0", padding: "0" }}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            )}
          </span>
        </div>
        {errorMsg && <p className="login-error">{errorMsg}</p>}
        <button disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
      </form>
      <p>
        Don't have an account?{" "}
        <span style={{ color: "var(--terminal-purple)", cursor: "pointer" }} onClick={() => navigate("/signup")}>
          Sign up here
        </span>
      </p>
    </div>
  );
}
