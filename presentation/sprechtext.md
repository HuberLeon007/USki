# USki – Präsentation: Sprechtext & Empfehlungen

> Sprechtext pro Folie (frei vortragen, nicht ablesen) + Hinweise was noch fehlt.
> Aktuelle Folien: 1 Titel, 2 Was ist USki?, 3 Techstack, 4 Container dev, 5 Container prod,
> 6/7 Sequence Login, 8 RBAC, 9/10 RAG. Vieles ist nur Titel + Bild – unten steht, was du dazu sagst.

---

## Folie 1 – USki (Titel)
**Sprechtext:**
"Hallo, ich bin Leon. Mein Projekt heißt USki – eine Lern-App mit Karteikarten, die mit einem
modernen Wiederholungs-Algorithmus und einem KI-Assistenten arbeitet. Ich zeige euch heute, was
die App kann, wie sie technisch aufgebaut ist und wie ich sie deploye."

---

## Folie 2 – Was ist USki?
> Diese Folie ist aktuell leer (nur Titel). **Stichpunkte dazupacken** (siehe unten "Was fehlt").

**Sprechtext:**
"USki ist eine Karteikarten-Lernplattform – vergleichbar mit Anki oder Quizlet, aber selbst gebaut.
Man legt Decks (Kartenstapel) an, erstellt Karten mit Vorder- und Rückseite, und lernt sie dann.
Das Besondere: Erstens ein spaced-repetition-Algorithmus (FSRS), der jede Karte genau dann wieder
zeigt, wenn man kurz davor ist sie zu vergessen. Zweitens ein KI-Assistent namens Sero, der Fragen
zu den eigenen Karten beantwortet. Und drittens kann man Decks mit anderen teilen und gemeinsam
bearbeiten. Es gibt eine Web-App und eine native Android-App."

**Vorschlag Stichpunkte auf der Folie:**
- Karteikarten-Lernplattform (Decks + Karten)
- FSRS spaced repetition (optimales Wiederholen)
- KI-Assistent "Sero" (Fragen zu eigenen Karten)
- Teilen & kollaboratives Bearbeiten von Decks
- Web-App + native Android-App

---

## Folie 3 – Techstack
**Sprechtext:**
"Frontend ist React mit TypeScript, React Router und Tailwind CSS. Das Backend ist Python mit
FastAPI, Pydantic für Validierung und Loguru fürs Logging. Als Datenbank und Auth nutze ich
Supabase – das ist PostgreSQL mit Extras. Mails laufen über Resend per SMTP, Redis dient zur
Rate-Limitierung der API. Alles ist in Docker containerisiert. Für die KI-Funktion kommt noch
pgvector und ein lokales Embedding-Modell über Ollama dazu."

**Hinweis:** Supabase nehme ich, weil es PostgreSQL + pgvector + fertige Authentifizierung mitbringt.
Lokal nutzt es einen Mailpit-Test-SMTP, in der Cloud einen eigenen SMTP (Resend Free).

---

## Folie 4 – Containerdiagramm (dev)
**Sprechtext:**
"So sieht die lokale Entwicklungsumgebung aus. Alles läuft in Docker-Containern: das Frontend über
Vite, das FastAPI-Backend, ein lokales Supabase, Redis und Ollama für die Embeddings. So kann ich
komplett offline entwickeln, ohne Cloud-Kosten und ohne echte Mails zu verschicken – die landen im
Mailpit-Testserver."

---

## Folie 5 – Containerdiagramm (prod)
**Sprechtext:**
"In Produktion läuft es anders. Die App ist öffentlich erreichbar unter uski.huberleon.com, gehostet
auf einem Schul-Server. Das Spannende: Der Server hat keine öffentliche IP und kein Port-Forwarding –
ich nutze einen Cloudflare Tunnel. Der Server baut nur eine ausgehende Verbindung zu Cloudflare auf,
Cloudflare macht das HTTPS. Caddy serviert die Web-App und leitet API-Anfragen ans Backend weiter.
Die Datenbank liegt in Supabase Cloud in der EU, die Embeddings macht weiterhin ein lokales Ollama,
und der KI-Chat nutzt einen Pool aus mehreren kostenlosen Anbietern. Komplett gratis."

---

## Folie 6 & 7 – Sequenzdiagramm: Login
> Achtung: Folie 6 und 7/8 heißen beide "Sequence Diagramm – Login". **Eine davon umbenennen**
> (vermutlich gehört eine zu "Lernen/Review" – siehe Diagramm g6_review).

**Sprechtext (Login):**
"Der Login läuft passwortlos. Man gibt seine E-Mail ein, Supabase schickt einen 6-stelligen Code per
Mail, den gibt man ein und ist eingeloggt. Das Backend validiert dabei das JWT von Supabase. Zusätzlich
gibt es Social-Login über Google, GitHub und Discord, sowie Passkeys – also Login per Fingerabdruck
oder Gesichtserkennung über WebAuthn. Optional kann man noch einen zweiten Faktor per
Authenticator-App (TOTP) aktivieren. Bei jedem Login werden Gerät, IP und Standort erfasst und in den
Sicherheitseinstellungen mit Karte angezeigt."

---

## Folie 8 – Rollenbasierte Zugriffsrechte (RBAC)
**Sprechtext:**
"Decks kann man teilen, mit drei Stufen: read, edit und share. Read heißt nur lernen, edit erlaubt
Karten zu bearbeiten, share erlaubt das Weitergeben. Ein geteiltes Deck wird dabei nicht kopiert,
sondern referenziert – es existiert nur einmal in der Datenbank. Jeder Lernende hat aber seinen
eigenen Lernfortschritt, der getrennt gespeichert wird. Löschen darf nur der Ersteller; wenn er das
Deck löscht, verlieren automatisch alle den Zugriff, weil die Datenbank das per Fremdschlüssel-Cascade
mitlöscht. Beim gleichzeitigen Bearbeiten gibt es außerdem Edit-Locks, damit sich niemand gegenseitig
überschreibt."

---

## Folie 9 & 10 – Sequenzdiagramm: RAG (Sero / KI)
**Sprechtext:**
"Sero ist der KI-Assistent. Damit er Fragen zu den eigenen Karten beantworten kann, nutze ich RAG –
Retrieval Augmented Generation. Jede Karte wird per Embedding-Modell in einen Vektor aus 768 Zahlen
umgewandelt, der ihre Bedeutung repräsentiert, und in der Datenbank mit pgvector gespeichert. Stellt
man eine Frage, wird auch die Frage zu einem Vektor, und pgvector sucht die inhaltlich ähnlichsten
Karten. Diese gehen dann als Kontext an das Sprachmodell. So antwortet Sero auf Basis der echten
Karten und erfindet nichts dazu."

---

## Was auf der PP noch fehlt / verbessern

1. **Folie "Was ist USki?" füllen** – aktuell nur Titel. Stichpunkte oben einbauen.
2. **Doppelten Titel "Sequence Diagramm – Login" korrigieren** (eine davon ist wohl "Lernen/Review").
3. **Folie "Lernen mit FSRS"** ergänzen – das ist DAS Kernfeature und fehlt als eigener Punkt.
   Sprechtext: "Beim Lernen bewertet man jede Karte mit again, hard, good oder easy. Der FSRS-Algorithmus
   berechnet daraus den neuen Lernstand und den nächsten Fälligkeitstermin. Schwere Karten kommen bald
   wieder, leichte erst in Tagen oder Wochen – so lernt man effizient und vergisst weniger."
   (Diagramm dafür liegt schon unter `_src/g6_review.mmd`.)
4. **Folie "Mobile App"** – Expo/React Native, native Android-APK, Passkeys auch am Handy, gleicher
   Backend. Zeigt Plattform-Breite.
5. **Folie "Sicherheit"** – Passkeys/WebAuthn, 2FA (TOTP), Session-/Geräte-Übersicht mit Standort-Karte,
   Row-Level-Security in der DB. Macht Eindruck.
6. **Folie "KI-Provider-Pool"** kurz – mehrere kostenlose Chat-Anbieter im Round-Robin, damit der Chat
   gratis und ausfallsicher läuft.
7. **Live-Demo-Folie** – ein Slide "Demo" als Übergang zum echten Zeigen (Deck anlegen, lernen, Sero
   fragen, teilen). Eine Demo zieht immer mehr als Folien.
8. **Abschluss-Folie** – Fazit + Ausblick (was gelernt, was würdest du als Nächstes bauen) +
   "Danke / Fragen?". Aktuell endet die PP ohne Schluss.
9. **Herausforderungen/Lessons Learned** (optional) – z.B. Deployment ohne öffentliche IP gelöst über
   Cloudflare Tunnel, Embedding-Dimension fix auf 768, OneDrive-Probleme beim Android-Build. Zeigt
   Reflexion.

## Roter Faden (Reihenfolge-Vorschlag)
Titel → Was ist USki? → (Demo kurz?) → Techstack → Container dev → Container prod →
Login/Sicherheit → RBAC/Teilen → Lernen mit FSRS → Sero/RAG → Mobile → Fazit & Fragen.

## Vortrags-Tipps
- Nicht den Code zeigen, sondern den Nutzen ("warum") erklären.
- Fachbegriffe einmal kurz übersetzen (RAG, Embedding, FSRS, RBAC, JWT).
- Bei den Sequenzdiagrammen mit dem Finger den Pfeilen folgen, Schritt für Schritt.
- Wenn möglich: kurze Live-Demo statt nur Folien.
