import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SwiftAPIClient from "./components/SwiftAPIClient";
import AccountPage from "./components/AccountPage";
import LoginPage from "./components/LoginPage";
import Signup from "./components/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import Documentation from "./components/Documentation";
import ContactSupport from "./components/ContactSupport";
import { SwiftAPIProvider } from "./context/SwiftAPIContext";
import { refreshAccessToken } from "./services/authService";


export default function App() {
  useEffect(() => {
    // Proactively refresh access token on app start if user has an existing session
    if (localStorage.getItem("authToken") || localStorage.getItem("email")) {
      refreshAccessToken().catch(() => {});
    }
  }, []);
  return (
      <SwiftAPIProvider>

        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<SwiftAPIClient />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/contact-support" element={<ContactSupport />} />

            {/* Protected routes */}
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </SwiftAPIProvider>
  );
}

