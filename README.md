# USki — Next-Gen Flashcard App

USki ist eine intelligente, lokal gehostete Flashcard-App, die den modernen **FSRS-Algorithmus** für Spaced Repetition nutzt. Sie bietet eine NotebookLM-artige KI-Chat-Integration, einen Rich-Text-Editor für Karten sowie ein sicheres Rechte- und Sharing-System.

**Kernprinzip**: Alles läuft zu 100% lokal in Docker-Containern. Externe Cloud-Anbindungen (Supabase, Cloud-Sync, Mobile Apps) sind reine optionale Erweiterungen (Post-MVP).

---

## 🛠 Tech-Stack

- **Frontend**: React Router, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, Pydantic, Loguru
- **Datenbank**: PostgreSQL + `pgvector` (für semantische Suche/RAG)
- **Infrastruktur**: Docker & Docker Compose (100% lokal)
- **KI & Embeddings**: API-basiert (z.B. Google Gemini 1.5 Flash für Text & Vision)
- **E-Mail / 2FA**: Mailpit (lokaler SMTP-Server) & TOTP (QR-Code)

---

## 🐳 Geplante Docker-Container

Die gesamte Architektur wird über `docker-compose` orchestriert:

1. **`frontend`**: React/TypeScript Dev-Server.
2. **`backend`**: FastAPI Python-Server.
3. **`db`**: PostgreSQL-Datenbank inkl. `pgvector`-Erweiterung.
4. **`mailpit`**: Lokaler E-Mail-Server für den Versand von 2FA-Codes und System-Mails.

*(Hinweis: Weitere Container wie Redis oder PgBouncer können bei Bedarf zur Skalierung als Erweiterung hinzugefügt werden).*

---

## 🔐 Kernfunktionen & Sicherheit

- **E-Mail & 2FA**: Jeder Nutzer benötigt eine E-Mail-Adresse. Die Zwei-Faktor-Authentifizierung (2FA) wird per QR-Code (TOTP) eingerichtet, E-Mails laufen über den lokalen Mailpit-Container.
- **Dateisicherheit**: Es gibt **keinen direkten Dateizugriff** oder direkte Download-Links. Alle Dateien (Bilder, PDFs) liegen sicher im System/DB und werden nur über authentifizierte API-Routen (mit Token-Prüfung) ausgeliefert.
- **Rich-Text-Editor**: Karten werden wie in Word bearbeitet (Fett, Kursiv, Schriftgröße, Überschriften). Bilder können **beliebig oft und inline** (genau an der passenden Textstelle) eingefügt werden. Der Editor unterstützt zudem HTML/CSS-Vorlagen (wie bei Anki).
- **Sharing & Berechtigungen (RBAC)**: Decks können per Code oder Link geteilt werden. Das Berechtigungssystem ist hierarchisch:
  - `read`: Kann das Deck ansehen/lernen.
  - `edit`: Kann Karten bearbeiten (setzt `read` voraus).
  - `share`: Kann das Deck weiterteilen (setzt `edit` und `read` voraus).

---

## 📊 Logging-Architektur

Das Logging wird auf **drei Ebenen** betrieben, um vollständige Transparenz und einfache Fehlersuche zu gewährleisten:

1. **Container-Ebene (Docker)**: Standard-I/O-Logs aller Container (Healthchecks, Start/Stop-Events, Container-Crashes).
2. **Applikations-Ebene (FastAPI/Loguru)**: Detailliertes Logging von internen Prozessen, FSRS-Berechnungen, RAG-Pipeline-Schritten und Fehlern (Exceptions) im Backend.
3. **Request/Zugriffs-Ebene (API/DB)**: Audit-Logs für Logins, 2FA-Versuche, Berechtigungsprüfungen (Wer hat wann auf welche geteilte Datei zugegriffen?) sowie API-Zugriffe auf geschützte Ressourcen.
