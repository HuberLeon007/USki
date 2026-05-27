# Final Project Ideas (4 Weeks, 3h each)

## 🛠️ General Tech Stack for All Projects

The tech stack is designed for modern web development and optimized for your requirements: Your app runs locally, the services are free, and the AI is integrated via high-performance APIs (or optionally via your school server).

*   **Frontend (Web):** ReactRouter + TypeScript + Tailwind CSS (Industry standard, clean and fast UI development).
*   **Backend:** Python with FastAPI (very fast), Pydantic (for strict data validation of AI responses and API requests), and Loguru (for structured logging).
*   **Containerization:** The complete app, including logic and database, runs 100% locally in **Docker Containers** for now.
*   **Database & Authentication:** Local PostgreSQL Container. Authentication (if needed for the MVP) is handled natively by Python FastAPI. Supabase will only be introduced later as an extension for cloud sync.

### 🤖 AI Integration (Generous Free Tier APIs & Alternatives)
Since it makes sense to run the AI via an API, here are the best free/generous options. As a fallback, you have the perfect backup with the 16GB VRAM on the school server.
*   **Google Gemini API (Gemini 1.5 Flash):** Extremely generous free plan (often millions of tokens / month free). Very fast, excellent for structured JSON/Pydantic outputs.
*   **Groq API:** Offers open-source models (like Llama 3) via an extremely fast API. Very good free Developer Tier.
*   **Cohere API:** Has a permanent free tier for developers (with API limits per minute, but completely sufficient for a school project).
*   **Fallback (School Server with 16GB VRAM):** With 16GB VRAM, **Ollama** can easily be installed on the school server. There, models like *Llama 3 (8B)* or *Qwen* can run permanently and completely free of charge as your own API, without worrying about limits.

---

## 💡 The Project: USki (Next-Gen Flashcard App)

**USki** is an intelligent, modern evolution of Anki. Instead of relying on outdated algorithms (like Anki's SM-2), USki uses a state-of-art Spaced-Repetition System (e.g., **FSRS** - Free Spaced Repetition Scheduler) to calculate learning intervals perfectly and data-driven.

The app is primarily conceptualized as a fast, modern web app and runs strictly local in containers for the MVP.

### 🎯 Core Features (MVP)
*   **100% Local-First:** Absolutely all data (cards, learning progress, logs) remains strictly local in its own PostgreSQL container initially. No cloud dependencies in the first version (except for the external AI API Key).
*   **Modern Spaced Repetition:** Integration of FSRS instead of SM-2 for dramatically more efficient learning.
*   **NotebookLM-Style AI Chat:** Instead of dumb card generation, the AI actively supports *during* learning. When answering a flashcard, you can directly chat with the AI about this specific card (e.g., to ask deeper comprehension questions or to get the context explained more accurately).
*   **Containerized:** The entire setup (React Frontend, FastAPI Backend, local Postgres DB) runs cleanly encapsulated in Docker containers via `docker-compose`.

### 🚀 Extensions (Optional)
*   **Supabase Cloud Migration / Sync:** As soon as the local app is finished and tested, Supabase will be integrated as a cloud database and auth provider to enable automatic sync across multiple devices (Online).
*   **Desktop App:** Tauri wrapper for a native, fast desktop experience.
*   **Mobile App:** React Native (Expo) for Android for learning on the go.
