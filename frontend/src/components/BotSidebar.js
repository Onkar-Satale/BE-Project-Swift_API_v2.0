import { useState, useRef, useEffect, useContext } from "react";
import "./BotSidebar.css";
import { SwiftAPIContext } from "../context/SwiftAPIContext";
import { showToast } from "../utils/toast";
import { authenticatedFetch } from "../services/authService";
import { getCleanSnippet } from "../utils/snippetHelper";

export default function BotSidebar({
  onClose,
  currentApiContext = null,
  setShowBot
}) {
  const [input, setInput] = useState("");
  const botBodyRef = useRef(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedRag, setExpandedRag] = useState({});

  const { messages, setMessages } = useContext(SwiftAPIContext);

  const handleClearBot = () => {
    setMessages([
      {
        from: "bot",
        text: "Hi 👋 I’m your J.A.R.V.I.S. API assistant! You can ask me questions about API testing, HTTP protocols, headers, status codes, or request structures. ⚠️ Please note that I only answer questions related to API testing and development."
      }
    ]);
    setShowClearConfirm(false);
    showToast("🤖 Chat bot cleared!");
  };

  useEffect(() => {
    if (botBodyRef.current) {
      botBodyRef.current.scrollTo({
        top: botBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  /* ===============================
     🔹 SEND CONVERSATIONAL PROMPT
     =============================== */
  const handleSend = async () => {
    const userQuery = input.trim();
    if (!userQuery) return;

    const userMessage = { from: "user", text: userQuery };
    setMessages((prev) => [
      ...prev,
      userMessage,
      { from: "bot", text: "Thinking...", isTemp: true }
    ]);
    setInput("");

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await authenticatedFetch(`${backendUrl}/api/ai/bot`, {
        method: "POST",
        body: JSON.stringify({
          userId: "user123",
          message: userQuery,
          currentApiContext: currentApiContext,
          requestHistory: messages
        })
      });

      const data = await response.json();
      let botMessage = "";

      if (!response.ok) {
        botMessage = `⚠️ Error ${response.status}: ${data.error || data.message || data.detail || JSON.stringify(data)}`;
      } else {
        botMessage = data.text || "Got it!";
      }

      setMessages((prev) => [
        ...prev.filter((msg) => !msg.isTemp),
        { from: "bot", text: botMessage }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((msg) => !msg.isTemp),
        { from: "bot", text: "❌ Failed to reach AI bot. Try again." }
      ]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSend();
  };

  /* =============================================================
     🔹 RICH MARKDOWN & CHAT PARSER FOR CONVERSATIONAL RESPONSES
     ============================================================= */
  const renderInlineMarkdown = (inlineText) => {
    if (!inlineText) return null;

    // Tokenize for inline code `...`, bold **...**, italics *...*, and URLs
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+)/g;
    const parts = inlineText.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline code pill: `code`
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code key={idx} className="bot-inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold text: **bold**
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={idx} className="bot-bold-text">{part.slice(2, -2)}</strong>;
      }

      // Italic text: *italic*
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={idx} className="bot-italic-text">{part.slice(1, -1)}</em>;
      }

      // URLs / Links
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="bot-chat-link"
          >
            {part}
          </a>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  };

  const renderBotFormattedMessage = (text) => {
    if (typeof text !== "string") return null;

    // 1. Separate code blocks (```...```) from markdown text blocks
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const elements = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      // Text before code block
      if (matchIndex > lastIndex) {
        const textChunk = text.substring(lastIndex, matchIndex);
        elements.push({ type: "text", content: textChunk });
      }

      const lang = match[1] || "code";
      const code = match[2] || "";
      elements.push({ type: "code", lang, code });
      lastIndex = matchIndex + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < text.length) {
      elements.push({ type: "text", content: text.substring(lastIndex) });
    }

    return (
      <div className="bot-formatted-chat-flow">
        {elements.map((elem, elemIdx) => {
          if (elem.type === "code") {
            const cleanCode = elem.code.trim();
            return (
              <div key={elemIdx} className="bot-chat-codeblock">
                <div className="bot-codeblock-header">
                  <span className="bot-codeblock-lang">{elem.lang.toUpperCase() || "CODE"}</span>
                  <button
                    type="button"
                    className="bot-codeblock-copy"
                    onClick={() => {
                      navigator.clipboard.writeText(cleanCode);
                      showToast("📋 Code copied to clipboard!");
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="bot-codeblock-pre">
                  <code>{cleanCode}</code>
                </pre>
              </div>
            );
          }

          // Process text chunks: handle headings, lists, and paragraphs
          const paragraphs = elem.content.split(/\n\s*\n/);
          return (
            <div key={elemIdx} className="bot-chat-text-chunk">
              {paragraphs.map((p, pIdx) => {
                const trimmed = p.trim();
                if (!trimmed) return null;

                // Headings (### or ## or #)
                if (trimmed.startsWith("#")) {
                  const headingLevelMatch = trimmed.match(/^(#{1,4})\s+(.*)$/m);
                  if (headingLevelMatch) {
                    const headingText = headingLevelMatch[2];
                    return (
                      <h4 key={pIdx} className="bot-chat-heading">
                        {renderInlineMarkdown(headingText)}
                      </h4>
                    );
                  }
                }

                // Bullet or Numbered Lists
                const lines = trimmed.split("\n");
                const isList = lines.every((line) => /^\s*([*\-•]|\d+\.)\s+/.test(line.trim()));

                if (isList) {
                  return (
                    <ul key={pIdx} className="bot-chat-list">
                      {lines.map((l, lIdx) => {
                        const cleanLine = l.replace(/^\s*([*\-•]|\d+\.)\s+/, "").trim();
                        return (
                          <li key={lIdx} className="bot-chat-list-item">
                            {renderInlineMarkdown(cleanLine)}
                          </li>
                        );
                      })}
                    </ul>
                  );
                }

                // Normal Paragraph
                return (
                  <p key={pIdx} className="bot-chat-paragraph">
                    {lines.map((line, lIdx) => (
                      <span key={lIdx}>
                        {renderInlineMarkdown(line)}
                        {lIdx < lines.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const token = localStorage.getItem("authToken");

  if (!token) {
    return (
      <div className="bot-sidebar">
        <div className="bot-header">
          <div className="bot-header-left">
            <h3 style={{ color: "#ff8810", fontWeight: "bold", margin: 0, whiteSpace: "nowrap" }} className="bot-title">
              JARVIS AI Assistant
            </h3>
          </div>
          <button className="close-btn" onClick={onClose}>✖</button>
        </div>
        <div className="bot-auth-prompt" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100% - 60px)",
          padding: "20px",
          textAlign: "center",
          color: "#aaa"
        }}>
          <div style={{ fontSize: "40px", marginBottom: "15px" }}>🔒</div>
          <h4 style={{ color: "#fff", marginBottom: "10px", fontSize: "18px" }}>Authentication Required</h4>
          <p style={{ fontSize: "14px", marginBottom: "20px", lineHeight: "1.5" }}>
            Please log in to chat with J.A.R.V.I.S. and utilize RAG auto-fix diagnostics.
          </p>
          <a
            href="/login"
            className="login-prompt-btn"
            onClick={() => setShowBot(false)}
            style={{
              display: "inline-block",
              background: "#ff7f00",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bot-sidebar">
      {/* HEADER */}
      <div className="bot-header">
        <div className="bot-header-left">
          <h3 style={{ color: "#ff8810", fontWeight: "bold", margin: 0, whiteSpace: "nowrap" }} className="bot-title">
            ⚡ JARVIS Diagnostics & Assistant
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="refresh-btn"
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
            title="Refresh/Clear Chat"
          >
            🔄
          </button>
          <button className="close-btn" onClick={onClose} style={{ padding: 0, display: "flex", alignItems: "center" }}>✖</button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal terminal-modal">
            <div className="modal-title">⚠️ ALERT: REFRESH ASSISTANT</div>
            <div className="modal-body-text">
              Are you sure you want to refresh the assistant? This will clear all current session messages.
            </div>
            <div className="modal-actions">
              <button className="btn-no" onClick={() => setShowClearConfirm(false)}>[ NO, CANCEL ]</button>
              <button className="btn-yes" onClick={handleClearBot}>[ YES, CLEAR ]</button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT BODY */}
      <div className="bot-body" ref={botBodyRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`bot-message ${msg.from}`}>
            {/* USER MESSAGE */}
            {msg.from === "user" && (
              <div className="user-bubble-wrapper">
                <div className="user-bubble-header">
                  <span className="user-badge-icon">👤 You</span>
                </div>
                <div className="user-bubble-content">{String(msg.text)}</div>
              </div>
            )}

            {/* V2 STRUCTURED FAILURE ASSISTANT MESSAGE */}
            {msg.from === "bot" && msg.type === "failure_assist" && msg.diagnosis && (
              <div className="failure-assist-container">
                <div className="failure-alert-banner">
                  <span className="alert-bolt">⚡</span>
                  <div>
                    <h4 className="failure-heading">Failure Detected ({msg.status || 500})</h4>
                    <p className="failure-subtext">
                      {msg.diagnosis.why || msg.diagnosis.whatHappened || msg.diagnosis.rootCause?.probableCause || "Request failed with an error."}
                    </p>
                  </div>
                </div>

                {/* Compact RAG Pill / Details */}
                {msg.retrievedEpisodes && msg.retrievedEpisodes.length > 0 && (
                  <div className="rag-compact-wrapper">
                    <button 
                      type="button"
                      className="rag-compact-pill"
                      onClick={() => setExpandedRag(prev => ({ ...prev, [i]: !prev[i] }))}
                    >
                      <span>🏛️ RAG: {msg.retrievedEpisodes.length} historical precedent(s) verified ({msg.retrievedEpisodes[0]?.matchPercentage || 100}% match)</span>
                      <span className="rag-expand-arrow">{expandedRag[i] ? "▲" : "▼"}</span>
                    </button>

                    {expandedRag[i] && (
                      <div className="rag-expanded-list">
                        {msg.retrievedEpisodes.map((ep, epIdx) => (
                          <div key={epIdx} className="rag-episode-card-mini">
                            <div className="rag-mini-top">
                              <span className="rag-sim-pill">🎯 {ep.matchPercentage || 90}% Match</span>
                              <span className="rag-endpoint-name">📌 {ep.endpoint}</span>
                            </div>
                            <div className="rag-mini-outcome">
                              ✅ Outcome: Succeeded (Status {ep.resultStatus || 200})
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Root Cause Analysis (if present) */}
                {msg.diagnosis.rootCause && (
                  <div className="root-cause-box">
                    <div className="root-cause-header">
                      <span className="root-cause-layer-badge">
                        🔍 Layer: {msg.diagnosis.rootCause.predictedLayer || "General"}
                      </span>
                      {msg.diagnosis.rootCause.confidence && (
                        <span className="root-cause-confidence">
                          {msg.diagnosis.rootCause.confidence}% confidence
                        </span>
                      )}
                    </div>
                    {msg.diagnosis.rootCause.probableCause && (
                      <div className="root-cause-text">
                        <strong>Cause:</strong> {msg.diagnosis.rootCause.probableCause}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommended Action Steps */}
                {msg.diagnosis.whatToDo && msg.diagnosis.whatToDo.length > 0 && (
                  <div className="what-to-do-box">
                    <span className="what-to-do-title">📋 Recommended Actions & Next Steps:</span>
                    {msg.diagnosis.whatToDo.map((step, sIdx) => (
                      <div key={sIdx} className="what-step">• {step}</div>
                    ))}
                  </div>
                )}

                {/* Suggested Fix / Code Snippet Preview with Clean Copy Button */}
                {msg.diagnosis.autoFix && (msg.diagnosis.autoFix.diff || msg.diagnosis.autoFix.title || msg.diagnosis.autoFix.description) && (() => {
                  const cleanSnippet = getCleanSnippet(msg.diagnosis.autoFix);
                  return (
                    <div className="suggested-fix-box">
                      <div className="suggested-fix-header">
                        <div className="suggested-fix-title-wrap">
                          <span className="fix-icon">💡</span>
                          <div>
                            <h5 className="fix-title">{msg.diagnosis.autoFix.title || "Suggested Fix"}</h5>
                            {msg.diagnosis.autoFix.description && (
                              <p className="fix-subtitle">{msg.diagnosis.autoFix.description}</p>
                            )}
                          </div>
                        </div>
                        {cleanSnippet && (
                          <button
                            type="button"
                            className="btn-copy-snippet"
                            onClick={() => {
                              navigator.clipboard.writeText(cleanSnippet);
                              showToast("📋 Clean payload snippet copied!");
                            }}
                            title="Copy clean snippet to clipboard"
                          >
                            📋 Copy Snippet
                          </button>
                        )}
                      </div>

                      {cleanSnippet && (
                        <div className="fix-diff-preview">
                          <pre className="diff-code">{cleanSnippet}</pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* BOT MESSAGE (STRING OR FALLBACK OBJECT) */}
            {msg.from === "bot" && msg.type !== "failure_assist" && (
              <div className="bot-bubble-wrapper">
                <div className="bot-bubble-header">
                  <span className="bot-badge-icon">🤖 JARVIS</span>
                  {msg.isTemp && <span className="bot-thinking-pill">Thinking...</span>}
                </div>
                <div className="bot-bubble-content">
                  {typeof msg.text === "string" ? (
                    renderBotFormattedMessage(msg.text)
                  ) : (
                    msg.text?.diagnosis && (
                      <div className="bot-diagnosis-box">
                        <div className="bot-diagnosis-title">🧠 Diagnosis</div>
                        <div className="bot-diagnosis-text">{msg.text.diagnosis}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="bot-footer">
        <input
          type="text"
          placeholder="Ask J.A.R.V.I.S. about API testing, headers, debugging..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
