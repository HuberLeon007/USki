# Abschlussprojekt Ideen (4 Wochen á 3h)

## 🛠️ Allgemeiner Tech-Stack für alle Projekte

Der Tech-Stack ist auf moderne Web-Entwicklung ausgelegt und für deine Anforderungen optimiert: Deine App läuft lokal, die Services sind kostenlos und die KI wird über performante APIs (oder optional über euren Schulserver) eingebunden.

*   **Frontend (Web):** React + TypeScript + Tailwind CSS (Branchenstandard, saubere und schnelle UI-Entwicklung).
*   **Backend:** Python mit FastAPI (sehr schnell), Pydantic (für strikte Datenvalidierung der KI-Antworten und API-Requests) und Loguru (für strukturiertes Logging).
*   **Dockerisierung:** Die komplette App inkl. Logik und Datenbank läuft fürs Erste 100% lokal bei dir in **Docker Containern**.
*   **Datenbank & Authentifizierung:** Lokaler PostgreSQL Container. Die Authentifizierung (falls fürs MVP schon nötig) steuert Python FastAPI selbst. Supabase kommt erst als Erweiterung für Cloud-Sync ins Spiel.

### 🤖 KI-Anbindung (Generous Free Tier APIs & Alternativen)
Da die KI sinnvollerweise über eine API laufen soll, hier die besten kostenlosen/großzügigen Optionen. Falls alle Stricke reißen, habt ihr mit den 16GB VRAM am Schulserver das perfekte Backup.
*   **Google Gemini API (Gemini 1.5 Flash):** Extrem großzügiger Free-Plan (oft Millionen von Tokens / Monat frei). Sehr schnell, super für strukturierte JSON/Pydantic-Ausgaben.
*   **Groq API:** Bietet Open-Source Modelle (wie Llama 3) über eine extrem schnelle API an. Sehr guter kostenloser Developer-Tier.
*   **Cohere API:** Hat einen dauerhaften Free-Tier für Entwickler (mit API-Limits pro Minute, aber für ein Schulprojekt völlig ausreichend).
*   **Fallback (Schulserver mit 16GB VRAM):** Mit 16GB VRAM lässt sich **Ollama** locker auf dem Schulserver installieren. Dort kann dann z.B. *Llama 3 (8B)* oder *Qwen* dauerhaft und komplett kostenlos als eure eigene API laufen, ohne dass Limits eine Rolle spielen.

---

## 💡 Das Projekt: USki (Next-Gen Flashcard App)

**USki** ist eine intelligente, moderne Weiterentwicklung von Anki. Statt auf veraltete Algorithmen (wie Anki's SM-2) zu setzen, nutzt USki ein hochmodernes Spaced-Repetition-System (z.B. **FSRS** - Free Spaced Repetition Scheduler), um Lernintervalle perfekt und datengetrieben zu berechnen. 

Die App ist primär als schnelle, moderne Web-App konzeptioniert und läuft fürs MVP strikt lokal in Containern.

### 🎯 Kernfunktionen (MVP)
*   **100% Local-First:** Absolut alle Daten (Karten, Lernfortschritt, Logs) bleiben anfangs strikt lokal in einem eigenen PostgreSQL-Container. Keine Cloud-Abhängigkeiten in der ersten Version (bis auf den externen AI API-Key).
*   **Modernstes Spaced Repetition:** Integration von FSRS anstelle von SM-2 für dramatisch effizienteres Lernen.
*   **NotebookLM-Style AI Chat:** Anstelle von stupider Kartengenerierung unterstützt die KI aktiv *während* des Lernens. Beantwortet man eine Karteikarte, kann man direkt über diese spezifische Karte mit der KI chatten (z.B. um tiefere Verständnisfragen zu stellen oder sich den Kontext genauer erklären zu lassen).
*   **Containerisiert:** Das gesamte Setup (React Frontend, FastAPI Backend, lokale Postgres DB) läuft sauber gekapselt in Docker-Containern via `docker-compose`.

### 🚀 Erweiterungen (Optional)
*   **Supabase Cloud-Migration / Sync:** Sobald die lokale App fertig und getestet ist, wird Supabase als Cloud-Datenbank und Auth-Provider angebunden, um dann automatischen Sync über mehrere Geräte (Online) zu ermöglichen.
*   **Desktop App:** Tauri-Wrapper für eine native, schnelle Desktop-Erfahrung.
*   **Mobile App:** React Native (Expo) für Android zum Lernen unterwegs.

