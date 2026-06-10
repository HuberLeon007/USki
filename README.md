# USki — Next-Gen Flashcard App

USki ist eine intelligente, containerisierte Flashcard-App, die den modernen **FSRS-Algorithmus** für Spaced Repetition nutzt. Sie bietet eine NotebookLM-artige KI-Chat-Integration, einen Rich-Text-Editor für Karten sowie ein sicheres Rechte- und Sharing-System.

**Kernprinzip**: Alles läuft in Docker-Containern mit Supabase Cloud als festem Backend (Database, Auth, Storage, Realtime). Supabase ist ein integraler Kernbestandteil der Architektur — kein optionales Feature.

---

## 🛠 Tech-Stack

- **Frontend**: React Router, TypeScript, Tailwind CSS, shadcn UI
- **Backend**: Python, FastAPI, Pydantic, Loguru
- **Datenbank & Backend-Services**: Supabase Cloud — PostgreSQL + `pgvector` + Auth + Storage + Realtime
- **Infrastruktur**: Docker & Docker Compose — alle Anwendungs-Container laufen isoliert, nichts nativ auf dem Host.
- **KI & Embeddings**: API-basiert (z.B. Google Gemini 1.5 Flash für Text & Vision)
- **E-Mail Login**: Supabase Auth Passwordless OTP mit 6-stelligem E-Mail-Code. Kein Passwort und kein klassisches Register/Login mit Passwort.
- **E-Mail Versand**: Resend SMTP (Login-Codes und Auth-E-Mails über `huberleon.com`), konfiguriert in Supabase Auth.

---

## 🐳 Docker-Container (Application Runtime)

Backend und Frontend laufen **ausschließlich in Docker-Containern** — nichts wird nativ auf dem Host installiert. Alle Backend-Services (DB, Auth, Storage, Realtime, E-Mail) werden extern bereitgestellt:

1. **`frontend`**: React/TypeScript (Produktions-Build via Nginx).
2. **`backend`**: FastAPI Python-Server (Supabase JWT Validierung).

*(Keine lokalen Service-Container — Datenbank (Supabase), E-Mails (Resend), Storage und Auth laufen vollständig extern.)*

---

## 🔐 Kernfunktionen & Sicherheit

- **Passwortloser Login**: Nutzer melden sich nur mit ihrer E-Mail-Adresse an. Supabase Auth sendet bei jeder neuen Anmeldung einen 6-stelligen Verification Code per E-Mail. Nach erfolgreicher Code-Eingabe erhält der Client eine Supabase Session/JWT. Es gibt kein Passwort und keinen separaten Registrierungsprozess.
- **E-Mail Versand**: Login-Codes und Auth-E-Mails werden über **Resend SMTP** mit der Domain `huberleon.com` versendet. Kein lokaler Mailserver nötig.
- **Dateisicherheit**: Alle Dateien (Bilder, PDFs) liegen in **Supabase Storage Buckets** und werden durch **Row-Level Security (RLS)** Policies geschützt. Nur authentifizierte Nutzer mit entsprechenden Berechtigungen können auf Dateien zugreifen.
- **Rich-Text-Editor**: Karten werden wie in Word bearbeitet (Fett, Kursiv, Schriftgröße, Überschriften). Bilder können **beliebig oft und inline** (genau an der passenden Textstelle) eingefügt werden. Der Editor unterstützt zudem HTML/CSS-Vorlagen (wie bei Anki).
- **Sharing & Berechtigungen (RBAC)**: Decks können per Code oder Link geteilt werden. Das Berechtigungssystem ist hierarchisch:
  - `read`: Kann das Deck ansehen/lernen.
  - `edit`: Kann Karten bearbeiten (setzt `read` voraus).
  - `share`: Kann das Deck weiterteilen (setzt `edit` und `read` voraus).

---

## 📊 Logging-Architektur

Das Logging wird auf **drei Ebenen** betrieben, um vollständige Transparenz und einfache Fehlersuche zu gewährleisten:

1. **Container-Ebene (Docker)**: Standard-I/O-Logs der beiden Anwendungs-Container (backend, frontend).
2. **Applikations-Ebene (FastAPI/Loguru)**: Detailliertes Logging von internen Prozessen, FSRS-Berechnungen, RAG-Pipeline-Schritten und Fehlern (Exceptions) im Backend.
3. **Request/Zugriffs-Ebene (API/DB)**: Audit-Logs für E-Mail-Code-Logins, Berechtigungsprüfungen (Wer hat wann auf welche geteilte Datei zugegriffen?) sowie API-Zugriffe auf geschützte Ressourcen.
