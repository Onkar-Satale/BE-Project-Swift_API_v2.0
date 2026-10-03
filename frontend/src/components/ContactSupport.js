import React, { useState, useEffect } from "react";
import { getToken } from "../services/authService";
import { showToast } from "../utils/toast";
import "./ContactSupport.css";

const ContactSupport = () => {
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        const loadUser = () => {
            const token = getToken();
            if (!token) return;
            const username = localStorage.getItem("username");
            const email = localStorage.getItem("email");
            if (username && email) {
                setUserData({ username, email });
            }
        };
        loadUser();
    }, []);

    const handleFocusName = () => {
        if (!form.name && userData?.username) {
            setForm(prev => ({ ...prev, name: userData.username }));
        }
    };

    const handleFocusEmail = () => {
        if (!form.email && userData?.email) {
            setForm(prev => ({ ...prev, email: userData.email }));
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);

        try {
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    access_key: process.env.REACT_APP_WEB3FORMS_KEY,
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    subject: form.subject,
                    message: form.message,
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast("☑️ Message sent successfully!");
                setForm({ name: "", email: "", phone: "", subject: "", message: "" });
            } else {
                throw new Error(data.message || "Failed to submit form");
            }

        } catch (error) {
            console.error("Support submission failed:", error);
            showToast("❌ Message submission failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="support-page">
            <h1>Contact Support</h1>

            <div className="support-card">
                <form onSubmit={handleSubmit} className="support-form">
                    {/* Name */}
                    <div className="form-group">
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            onFocus={handleFocusName}
                            required
                            placeholder=" "
                            autoComplete="off"
                        />
                        <label>Name</label>
                    </div>

                    {/* Email */}
                    <div className="form-group">
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            onFocus={handleFocusEmail}
                            required
                            placeholder=" "
                            autoComplete="off"
                        />
                        <label>Email</label>
                    </div>

                    {/* Phone */}
                    <div className="form-group">
                        <input
                            type="text"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder=" "
                            autoComplete="off"
                        />
                        <label>Phone</label>
                    </div>

                    {/* Subject */}
                    <div className="form-group">
                        <input
                            type="text"
                            name="subject"
                            value={form.subject}
                            onChange={handleChange}
                            required
                            placeholder=" "
                            autoComplete="off"
                            spellCheck="false"
                        />
                        <label>Subject</label>
                    </div>

                    {/* Message */}
                    <div className="form-group">
                        <textarea
                            name="message"
                            rows="6"
                            value={form.message}
                            onChange={handleChange}
                            required
                            placeholder=" "
                        />
                        <label>Message</label>
                    </div>

                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Sending..." : "Submit"}
                    </button>
                </form>
            </div>

        </div>
    );
};

export default ContactSupport;
