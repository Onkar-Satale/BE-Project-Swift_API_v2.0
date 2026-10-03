# ⚡ Swift API v2.0 – Intelligent Full-Stack API Testing & History-Grounded AI Debugging Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![NodeJS](https://img.shields.io/badge/Node.js-Express-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Store-FF6F61?style=for-the-badge&logo=databricks&logoColor=white)](https://www.trychroma.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Groq](https://img.shields.io/badge/Groq-AI%20LLM-F05032?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com/)

**Swift API v2.0** is an intelligent, developer-centric API testing and automated debugging platform. Moving beyond traditional REST clients, Swift API introduces **History-Grounded RAG (Retrieval-Augmented Generation)**, **Persistent ChromaDB Vector Memory**, **Autonomous Self-Healing Multi-Step Flows**, **Confirmed 1-Click AI Auto-Fix**, **History Capsule Comparison**, and **API Testing Timelines**.

---

## 🌟 Key Features

- 📨 **Multi-Method Request Engine:** Send `GET`, `POST`, `PUT`, `DELETE`, `PATCH` requests with custom headers, query params, and body modes (**`raw` JSON**, **`form-data`**, **`x-www-form-urlencoded`**, or **`none`**).
- 🔀 **Multi-Step Flow Studio & Pipeline Runner:** Visual multi-step pipeline builder with complete request editors per step (Params, Headers, JSON Body Editor, Auth, Settings, and Variable Extraction).
- ⚡ **Dynamic Variable Chaining & Postman Generators:** Extract response values (`authToken = data.token`, `tripId = data._id`) and pass them to downstream step URLs (`/api/trips/{{tripId}}`), headers (`Bearer {{authToken}}`), params, and bodies. Native support for `{{$timestamp}}`, `{{$random}}`, `{{$uuid}}`, and `{{$isoDate}}`.
- 🛠️ **Autonomous Self-Healing Execution:** Pauses on intermediate flow step failures, retrieves RAG precedents, applies 1-click repairs to broken endpoints/headers/bodies, and seamlessly auto-resumes downstream execution.
- 🏛️ **History-Grounded RAG System:** Stores resolution episodes (*Failure ➔ Diagnosis ➔ Applied Fix ➔ Success*) in a persistent **ChromaDB Vector Store** (`genai/chroma_db/`) with normalized dense semantic embeddings (`dim=64`) to eliminate LLM hallucinations.
- 🤖 **Confirmed AI Auto-Fix:** Detects route typos, missing query params, expired auth tokens, invalid JSON payloads, or wrong HTTP methods with instant 1-click workspace application.
- ⚖️ **History Capsule Comparison:** Compare any two historical API attempts side-by-side (e.g. Attempt A `404` vs Attempt B `200`) with visual diffs and AI progression explanations.
- 📈 **Interactive API Testing Timeline:** Time-series progression grouped by endpoint path tracking latencies, status transitions, and fix history over time.
- 🔄 **Automatic Silent Token Refresh:** Intercepts `401 Unauthorized` responses silently, rotating JWT access tokens via HTTP-only cookies without dropping user sessions.
- 💾 **Dual-Layer Persistence:** Cloud MongoDB storage with instant `localStorage` offline/guest fallback.

---

## 🧠 System Architecture & Design

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE v2.0 WORKFLOW                                     │
│                                                                                        │
│   API Request ──► Failure (4xx/5xx) ──► ChromaDB Vector Search (Past Episodes)        │
│          ▲                                             │                               │
│          │                                             ▼                               │
│     Auto-Index ◄── Re-Run (200 OK) ◄── Confirmed Fix ◄── AI Diagnosis & Root Cause     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

<div align="center">

<img src="assets/Architecture.png?raw=true" alt="Swift API System Architecture" width="100%" />

*Comprehensive System Design Architecture illustrating Frontend SPA, API Gateway Proxy, Python GenAI Microservice, Persistent ChromaDB Vector Store, Groq LLM Cloud Engine, and MongoDB Atlas Persistence.*

</div>

---

## 📂 Repository Structure

```
Swift_API/
├── assets/                     # Application screenshots & architecture diagrams
│   ├── Architecture.png
│   ├── Login.png
│   ├── Signup.png
│   ├── Headers.png
│   ├── Testing.png
│   ├── Account.png
│   └── Genai.png
├── backend/                    # Node.js + Express REST API Gateway
│   ├── config/                 # DB connection & environment configuration (db.js)
│   ├── controllers/            # Request proxy, auth, history, and flow controllers
│   ├── middlewares/            # JWT auth, rate limiting, error handling & sanitization
│   ├── models/                 # Mongoose schemas (userModel, historyModel, flowModel)
│   ├── routes/                 # Express API routes (authRoute, historyRoute, aiRoute, flowRoute)
│   ├── services/               # Core business services (authService, historyService, requestService)
│   ├── app.js                  # Express app initialization & security middlewares
│   ├── server.js               # Backend entry point
│   └── package.json
├── frontend/                   # React 18 Single Page Application
│   ├── public/
│   ├── src/
│   │   ├── components/         # Workspace components, Flow Studio, Modals & Sidebars
│   │   │   ├── FlowStudioModal.js      # Multi-Step Pipeline Builder & Self-Healing Runner
│   │   │   ├── FlowsSidebar.js         # Reactive Multi-Step Flow List & Status Badges
│   │   │   ├── BodyTab.js              # Multi-mode Body Editor (Raw JSON, Form-Data, Urlencoded)
│   │   │   ├── HistoryComparisonModal.js # Capsule Comparison Modal
│   │   │   ├── TestingTimelineModal.js # Interactive Testing Timeline Modal
│   │   │   ├── BotSidebar.js           # Conversational Assistant & Auto-Fix Dispatcher
│   │   │   ├── RequestBar.js           # Bidirectional URL & Params Bar
│   │   │   └── SwiftAPIClient.js       # Core Workspace Controller & Code-Split Suspense
│   │   ├── context/            # SwiftAPI Context & Global State
│   │   ├── services/           # authService, flowService, historyService
│   │   └── utils/              # Toast notifications, formatters & helpers
│   └── package.json
└── genai/                      # Python FastAPI GenAI Microservice
    ├── app/
    │   ├── config/             # Settings, Groq API client & Logger
    │   ├── routes/             # FastAPI endpoints (/failure-assist, /compare, /rag, /bot)
    │   ├── schemas/            # Pydantic validation schemas
    │   └── services/
    │       ├── llm_service.py  # Groq LLM integration & prompt chains
    │       └── rag_service.py  # Persistent ChromaDB & Embedding Engine
    ├── chroma_db/              # Persistent ChromaDB vector index directory
    ├── rag_episodes.json       # Pre-seeded RAG resolution memory episodes
    ├── requirements.txt        # Python dependencies (fastapi, chromadb, groq, uvicorn)
    └── main.py                 # FastAPI Uvicorn entry point
```

---

## 🛠️ Tech Stack

| Tier | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, React Router v7, Ace Editor, Vanilla CSS | Interactive API Client, Flow Studio & UI |
| **Primary Backend** | Node.js, Express.js, Mongoose, Winston | Core API Gateway, Proxy, JWT Auth, History & Flows |
| **AI Microservice** | Python 3.10+, FastAPI, Uvicorn, Groq SDK | RAG Failure Diagnosis, Health Scoring & Diff Engine |
| **Vector Database** | ChromaDB (Persistent Client, HNSW Cosine) | Real-time Embedding Storage & Semantic Memory |
| **Database** | MongoDB / MongoDB Atlas (`mydb` ➔ `swiftapiv2_users`) | User Accounts, Request Logs & Multi-Step Flows |
| **LLM Inference** | Groq LPU (`llama-3.1-8b-instant`, `qwen/qwen3.8-27b`) | Sub-second AI Diagnostic Generation (~180–300ms) |
| **Security** | JWT, bcryptjs, Helmet, Express Rate Limit | Token Auth, Password Hashing, Security Headers |

---

## ⚙️ Environment Configuration

Set up `.env` configuration files for each component service before running locally.

### 1. Backend Configuration (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/myDatabase
JWT_ACCESS_SECRET=superManKey
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=superSecretRefreshKey
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
GENAI_SERVICE_URL=http://127.0.0.1:8000
GENAI_API_SECRET=my_super_secret_ai_token_123
```

### 2. Frontend Configuration (`frontend/.env`)
```env
REACT_APP_BACKEND_URL=http://localhost:5000
FAST_REFRESH=true
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
```

### 3. AI Service Configuration (`genai/.env`)
```env
GROQ_API_KEY=your_groq_api_key_here
GENAI_API_SECRET=my_super_secret_ai_token_123
```

---

## 🚀 Local Installation & Setup

### Prerequisites
- **Node.js**: v18.x or higher
- **Python**: v3.10 or higher
- **MongoDB**: Local instance running on port `27017` or MongoDB Atlas URI
- **Groq API Key**: Obtainable from [Groq Console](https://console.groq.com/)

---

### Step-by-Step Setup

#### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Onkar-Satale/BE-Prioject-Swift_API_v2.0.git
cd BE-Prioject-Swift_API_v2.0
```

#### 2️⃣ Setup & Start Express Backend
```bash
cd backend
cp .env.example .env
npm install
npm start
```
> *Backend server runs at:* `http://localhost:5000`

#### 3️⃣ Setup & Start FastAPI GenAI Microservice
Open a new terminal window:
```bash
cd genai
cp .env.example .env

# Create virtual environment (optional)
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies and start server
pip install -r requirements.txt
python main.py
```
> *GenAI microservice with ChromaDB runs at:* `http://127.0.0.1:8000`

#### 4️⃣ Setup & Start React Frontend
Open a third terminal window:
```bash
cd frontend
cp .env.example .env
npm install
npm start
```
> *Frontend web app runs at:* `http://localhost:3000`

---

## 🔬 Academic Novelty & Research Paper Contributions

Swift API v2.0 introduces novel research contributions for automated software engineering and API testing:
1. **Episodic-RAG Resolution Memory:** Closed-loop case-based reasoning storing historical resolution quadruplets ($E = \langle S_{fail}, D_{root}, A_{fix}, S_{success} \rangle$) in persistent vector space.
2. **Sub-millisecond Dense HTTP Embeddings:** Fast 64-dimensional domain-specific HTTP vector representation using token modulo hashing and protocol hierarchy weighting without heavy neural models.
3. **Autonomous Pipeline Self-Healing:** Runtime execution halting, machine-executable JSON fix synthesis, and automatic resumption of multi-step API integration pipelines with dynamic variable preservation.

---

## 📡 API Reference Overview

| Endpoint | Method | Auth Required | Service | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/register` | `POST` | No | Express | User registration |
| `/api/login` | `POST` | No | Express | User authentication & JWT issuance |
| `/api/refresh-token` | `POST` | No | Express | Silent access token refresh via cookie |
| `/api/logout` | `POST` | Yes | Express | Invalidate refresh token and clear cookie |
| `/api/request` | `POST` | Yes | Express | Proxy & execute target HTTP API requests |
| `/api/history` | `GET` | Yes | Express | Retrieve authenticated user's request history |
| `/api/flows` | `GET` | Yes | Express | Retrieve all user multi-step flows |
| `/api/flows` | `POST` | Yes | Express | Create a new multi-step API pipeline flow |
| `/api/flows/:id` | `PUT` | Yes | Express | Update existing flow steps, auth, and settings |
| `/api/flows/:id` | `DELETE` | Yes | Express | Delete an API pipeline flow |
| `/api/flows/:id/run-results`| `POST`| Yes | Express | Record execution history & self-healing logs |
| `/api/ai/failure-assist` | `POST` | Yes | GenAI | History-Grounded RAG failure diagnosis & fix |
| `/api/ai/bot` | `POST` | Yes | GenAI | Context-aware conversational developer assistant |
| `/api/ai/compare` | `POST` | Yes | GenAI | Differential comparison between 2 attempts |
| `/api/ai/rag/index-episode` | `POST` | Yes | GenAI | Index verified resolution episode into ChromaDB |
| `/api/ai/rag/retrieve` | `POST` | Yes | GenAI | Top-$k$ semantic vector retrieval from ChromaDB |

---

## 📸 Screenshots & Visual Walkthrough

<div align="center">

<table width="100%">
  <tr>
    <td width="50%" align="center"><b>👁️ Request & Response Client</b></td>
    <td width="50%" align="center"><b>🤖 AI Error Debugger & RAG Assistant</b></td>
  </tr>
  <tr>
    <td><img src="assets/Testing.png?raw=true" width="100%" alt="Testing Interface" /></td>
    <td><img src="assets/Genai.png?raw=true" width="100%" alt="AI Debugger" /></td>
  </tr>
  <tr>
    <td align="center"><i>Send HTTP requests with raw JSON, form-data, or urlencoded bodies.</i></td>
    <td align="center"><i>History-grounded AI root cause analysis & 1-click auto-fixes.</i></td>
  </tr>
  <tr>
    <td align="center"><b>🔑 Login Interface</b></td>
    <td align="center"><b>🔒 Registration Page</b></td>
  </tr>
  <tr>
    <td><img src="assets/Login.png?raw=true" width="100%" alt="Login Page" /></td>
    <td><img src="assets/Signup.png?raw=true" width="100%" alt="Signup Page" /></td>
  </tr>
  <tr>
    <td align="center"><i>Secure user authentication with JWT token rotation.</i></td>
    <td align="center"><i>User onboarding with password validation.</i></td>
  </tr>
  <tr>
    <td align="center"><b>🧾 Headers Configuration</b></td>
    <td align="center"><b>👤 User Account Management</b></td>
  </tr>
  <tr>
    <td><img src="assets/Headers.png?raw=true" width="100%" alt="Headers Page" /></td>
    <td><img src="assets/Account.png?raw=true" width="100%" alt="Account Page" /></td>
  </tr>
  <tr>
    <td align="center"><i>Flexible key-value headers with {{variable}} interpolation.</i></td>
    <td align="center"><i>Manage user profiles, token expiration, and preferences.</i></td>
  </tr>
</table>

</div>

---

## 🤝 Contributing

Contributions are greatly appreciated! To contribute:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

---

## 👨‍💻 Author & Maintainer

- **Onkar Satale**
- **GitHub:** [@Onkar-Satale](https://github.com/Onkar-Satale)
- **Repository:** [BE-Prioject-Swift_API_v2.0](https://github.com/Onkar-Satale/BE-Prioject-Swift_API_v2.0)
