# USki — Master-Plan (Gesamtprojekt, lokal/Dev)

> Sprache: Dieser Plan ist auf Deutsch (Kommunikation mit dem Entwickler). **Alle UI-Texte,
> Code-Identifier, Datei- und Funktionsnamen bleiben Englisch.** Prod-Mode ist in dieser
> Planungsrunde ausdrücklich ausgeklammert — Ziel ist, dass **alles lokal (Dev) funktioniert**.

**Erstellt:** 2026-06-18 · **Stand:** überarbeitet nach Entwickler-Feedback
**Setup (bestätigt):** `supabase start` (lokales Supabase CLI) + `docker compose --profile dev up`
(Frontend + Backend laufen beide in Docker; Supabase/Ollama/Redis lokal).

---

## 1. Zielbild

USki soll lokal als vollwertige Flashcard-App laufen: Decks & Karten mit Rich-Text-Editor,
Ordner-artige **Deck-Gruppierung**, echtes Lernen mit **FSRS**, ein **KI-RAG-Chat** (lokal via
Ollama + pgvector, **Quellen ausschließlich aus den Karteninhalten**) und ein vollständiges,
hierarchisches **Sharing/RBAC**-System. Alles **fully responsive** (Desktop, Tablet, Mobile).

**Bewusst NICHT im Scope (jetzt):** Datei-/Dokument-Upload, Bild-Uploads in Karten,
Bild-Verständnis für RAG — das ist „für später oder nie".

Dieser Plan erweitert die bestehenden Pläne:
- `2026-06-15-auth-full-flow.md` (Auth/OTP/Username — umgesetzt, wird hier gefixt)
- `2026-06-12-landing-login-dashboard-design.md` (Design-Shell — wird hier überarbeitet)
- `2026-06-12-backend-chat-streaming.md` / `2026-06-12-frontend-streaming-chat.md` (Chat)
- die laufende Kiro-Spec `ux-redesign-onboarding` (UX-Redesign — Phase 0 baut darauf auf)

---

## 2. Aktueller Stand (Ist)

- **Auth:** OTP-Login funktioniert; Username-Setzen schlägt mit **401** fehl (Ursache: Issuer-Mismatch, s. Phase 0).
- **Frontend:** Landing/Login/Dashboard existieren; Dashboard nutzt **Mock-Decks**, KI-Assistant
  ist nur Preview, Editor/FSRS/Sharing fehlen.
- **Backend:** Auth-Endpoints + Username-Service vorhanden; `chat`-Route vorhanden. Decks/Karten/
  FSRS/RAG-Endpoints fehlen oder sind Platzhalter.
- **DB:** Nur `public.user`, `public.login_audit`, `public.user_sessions`. **Keine** Tabellen für
  Decks/Karten/Gruppen/Reviews/Shares.
- **Bekannte UI-Probleme:** HeroDemo zu flach/gequetscht; nicht durchgängig responsive; einzelne
  Decks werden fälschlich in der Sidebar gelistet.

---

## 3. Entscheidungen & Annahmen (final, Best Practice)

> Offene Punkte wurden nach Best Practices entschieden. Jede Entscheidung ist änderbar — sag Bescheid.

- **A1 — Mobile-Pattern:** Dashboard nutzt auf Mobile einen **Hamburger-Drawer** (Sidebar als
  Overlay), auf Tablet/Desktop die feste Sidebar.
- **A2 — HeroDemo auf Mobile:** vereinfachte/kompakte Vorschau (kein voller interaktiver Mock auf
  kleinen Screens); auf Desktop interaktiv und **höher** (nicht mehr gequetscht, via `aspect-ratio`).
- **A3 — Deck öffnen:** eigene **Deck-Detail-Route** (`/decks/:deckId`) mit Kartenliste + Editor.
- **A4 — „Review" (Übersicht):** zeigt **alle fälligen Decks** als Übersicht. Man startet
  **einzelne Decks** (oder eine **Gruppe**) gezielt — **kein Vermischen** von Decks in einer Session.
- **A5 — „All Decks":** umschaltbare **Grid-/Listen-Ansicht** aller Decks mit der einzigen
  „New deck"-Aktion. Decks sind in einer **Ordner-/Gruppenstruktur** organisierbar.
- **A6 — Plan-Struktur:** mehrere Phasen (Phase 0–6) in diesem Master-Plan; pro Phase wird bei
  Umsetzung eine eigene Kiro-Spec erstellt.
- **A7 — DB-Schema:** Decks/Gruppen/Karten/Reviews/Shares **neu entworfen** (Postgres + pgvector + RLS).
- **A8 — Editor & Kartenmodell (Entscheidung, ersetzt rohes HTML/CSS):**
  - **TipTap (ProseMirror)** als Rich-Text-Editor. Karteninhalt (`front`/`back`) wird als
    **strukturierter, serverseitig sanitierter Inhalt** gespeichert (TipTap-JSON + gerendertes,
    bereinigtes HTML) — **kein vom Nutzer frei geschriebenes HTML/CSS**.
  - **Warum nicht rohes HTML/CSS wie in Anki:** Sicherheit (XSS), Wartbarkeit, konsistentes
    Theming (Dark/Light) und saubere Mobile-Darstellung sind mit frei editierbarem HTML/CSS nicht
    robust machbar. Stattdessen: ein paar **vordefinierte, themebare Karten-Templates/Styles**
    (App-gesteuert, z.B. dein lila „Header-Bar"-Look als Preset) — gleiche Optik, aber sicher und
    pflegbar. Formatierung im Editor: Fett/Kursiv/Unterstreichen, Überschriften, Listen,
    Code/Quote, Farben aus dem Theme.
  - **Konva / tldraw (Zeichnen/Whiteboard) sind bewusst NICHT Teil dieser Phase** — Overkill für
    Karteikarten. Optional als spätere „Draw/Diagram"-Erweiterung vorgemerkt.
  - **Bilder in Karten:** vorerst **nicht** (kein Upload im Scope) — als spätere Erweiterung markiert.
- **A9 — Embeddings lokal:** Ollama **`nomic-embed-text`**; Chat-Modell `qwen3:4b`.
- **A10 — FSRS:** etablierte **`py-fsrs`-Bibliothek** (aktuelle FSRS-Version) statt
  Eigenimplementierung; gekapselt in `services/fsrs.py`. Deterministische Scheduling-Eigenschaften
  werden per Property-Test abgesichert.
- **A11 — Kein Datei-/Dokument-Upload:** Phase „Uploads" entfällt komplett. RAG zieht seine Quellen
  **ausschließlich aus den Karteninhalten** (front/back-Text).
- **A12 — Prod ausgeklammert:** nur Dev/lokal; Prod-Pfade (Gemini, Resend, Redis, Nginx-Build)
  werden bewusst nicht behandelt.

---

## 4. Querschnittsthemen (gelten für alle Phasen)

### 4.1 Responsive-Standard (verbindlich)
- Breakpoints (Tailwind): Mobile `< 640px`, Tablet `640–1024px`, Desktop `> 1024px`.
- Jede neue View wird in allen drei Größen geprüft. Keine fixen Pixelbreiten ohne `max-w-*`/`min-w-0`.
- Touch-Ziele ≥ 44px; keine horizontalen Overflows.
- Mobile-Navigation: **Hamburger-Drawer** (A1). Karteikarten: Querformat (Desktop/Tablet),
  Mobile-Portrait-Ausnahme (bereits umgesetzt).

### 4.2 Logging & Audit (laut README, 3 Ebenen)
- Container-Logs (Docker), App-Logs (Loguru im Backend), Request/Audit-Logs (Logins,
  Permission-Checks, **Zugriffe & Rechteänderungen** auf geteilte Decks). Jede Backend-Phase
  ergänzt passende Loguru-Logs + Audit-Einträge.

### 4.3 Testing
- Backend: `pytest` (+ `hypothesis` für reine Funktionen) — JWKS/Supabase gemockt.
- Frontend: `tsc --noEmit` als Pflicht-Gate; optional `vitest + fast-check` für reine Helfer.
- Property-Tests für reine Logik (FSRS-Scheduling, Permission-Auflösung, Username-Ableitung).

---

## Phase 0 — Sofort-Fixes: Auth, Responsive, Dashboard-Redesign, HeroDemo

**Ziel:** Username-Bug endgültig beheben, alles responsive machen, Dashboard-Nav vereinfachen,
HeroDemo entzerren. Baut auf der laufenden Spec `ux-redesign-onboarding` auf.

### 0.1 Auth-Fix (Issuer-Mismatch) — ECHTE Ursache
**Problem:** `security.py` prüft `issuer = SUPABASE_URL + "/auth/v1"`. Backend-`SUPABASE_URL` =
`http://host.docker.internal:54321`, aber das Browser-Token hat `iss = http://127.0.0.1:54321/auth/v1`
→ Issuer stimmt nie überein → **401** bei jedem authentifizierten Call.

**Fix:**
- Neue Setting `SUPABASE_PUBLIC_URL` (browser-seitig, Default Dev `http://127.0.0.1:54321`).
- `security.py`: Issuer-Prüfung gegen eine **Allow-List** zulässiger Issuer
  (`SUPABASE_PUBLIC_URL`, `SUPABASE_URL`, plus `localhost`/`127.0.0.1`-Varianten im Dev).
  JWKS-Fetch + Service-Client weiterhin über die interne `SUPABASE_URL`.
- `.env.example` / `docker-compose.yml` um `SUPABASE_PUBLIC_URL` ergänzen.
- Backend-Test: Token mit `iss=127.0.0.1` wird akzeptiert; fremder Issuer → 401.

**Aufgaben:**
- [ ] `config.py`: `SUPABASE_PUBLIC_URL` + Property `allowed_issuers`.
- [ ] `security.py`: Issuer-Allow-List statt Einzel-Issuer; sprechende Loguru-Logs bei Mismatch.
- [ ] `docker-compose.yml` (backend) + `.env.example`: `SUPABASE_PUBLIC_URL` setzen.
- [ ] Tests: `tests/test_auth.py` um Issuer-Fälle erweitern.

### 0.2 HeroDemo entzerren + responsiv
- [ ] Feste Höhe durch `aspect-ratio`/größere `min-h` ersetzen, damit der Mock nicht flachgedrückt wird.
- [ ] Mobile: kompakte Variante (A2) — Sidebar/Assistant ausblenden, nur Kernpanel + Hinweis.
- [ ] In allen Breakpoints testen.

### 0.3 Dashboard-Nav vereinfachen
- [ ] Sidebar enthält nur noch **„Review"** und **„All Decks"** (keine Einzel-Decks).
  (Ein dritter Eintrag **„Shared"** kommt in Phase 5 hinzu.)
- [ ] „Review" → Übersicht fälliger Decks, Start je Deck/Gruppe (A4). „All Decks" → Grid/Liste + „New deck" (A5).
- [ ] Settings unten über Username (bereits umgesetzt), kein Logout in der Sidebar (umgesetzt).

### 0.4 Durchgängig responsive
- [ ] Mobile: **Hamburger-Drawer** (A1) statt fixer Sidebar; Sidebar fest ab Tablet/Desktop.
- [ ] Login/Landing/Dashboard/Settings/Assistant in allen Breakpoints prüfen und fixen.

---

## Phase 1 — Daten-Fundament (DB-Schema + RLS)

**Ziel:** Persistente Tabellen für Gruppen, Decks, Karten, Reviews, Shares — mit Row-Level Security.

**Vorgeschlagenes Schema (Supabase Migrations):**
- `public.deck_group` — Ordnerstruktur: `id, owner_id, name, parent_group_id (self-FK, nullable),
  position, created_at`. Erlaubt verschachtelte Gruppen (A5).
- `public.deck` — `id, owner_id, group_id (→ deck_group, nullable), title, description,
  card_template ('default'|…), created_at, updated_at`.
- `public.card` — `id, deck_id (→ deck), front_json, front_html, back_json, back_html,
  created_at, updated_at` (TipTap-JSON + sanitiertes HTML, A8).
- `public.card_schedule` — FSRS-State pro Karte/User: `card_id, user_id, due, stability,
  difficulty, reps, lapses, state, last_review` (Felder gemäß `py-fsrs`).
- `public.deck_share` — RBAC: `deck_id, grantee_id, permission ('read'|'edit'|'share'),
  granted_by, created_at` + `share_code`/`share_link`.
- `public.deck_access_log` — Audit: wer hat wann auf welches geteilte Deck zugegriffen / Rechte geändert.
- `public.permission_notification` — ausstehende Hinweise an Nutzer (Rechte erteilt/entzogen),
  angezeigt beim nächsten Login (Phase 5).
- `public.document_chunk` — RAG-Index **aus Karteninhalten**: `card_id, deck_id, content,
  embedding (vector)` — **keine** separate Upload-/Document-Tabelle (A11).
- **RLS-Policies** für alle Tabellen (Owner + geteilte Berechtigungen).
- **pgvector** aktivieren, Index auf `document_chunk.embedding`.

**Aufgaben:**
- [ ] Migrationsdateien in `supabase/migrations/` (nummeriert).
- [ ] RLS-Policies + Helper-Funktion zur Permission-Auflösung (Owner > share-Eintrag, read<edit<share).
- [ ] `pgvector`-Extension + Vektor-Index.
- [ ] Pydantic-Schemas (`schemas/deck.py`, `card.py`, `fsrs.py` — teils vorhanden, anpassen).
- [ ] Backend-Tests gegen lokales Supabase (oder gemockt).

---

## Phase 2 — Decks, Gruppen & Karten (CRUD + Editor)

**Ziel:** Echte Decks/Gruppen/Karten anlegen, bearbeiten, löschen; sauberer Rich-Text-Editor.

**Backend:**
- [ ] `api/groups.py` — CRUD für `deck_group` (verschachtelbar), Reihenfolge/Verschieben.
- [ ] `api/decks.py` — CRUD `/api/decks`, `/api/decks/{id}`, Deck in Gruppe verschieben (RLS-geschützt).
- [ ] `api/cards.py` — CRUD für Karten innerhalb eines Decks; HTML serverseitig **sanitisieren**.
- [ ] `services/permissions.py` ausbauen (read/edit-Checks).

**Frontend:**
- [ ] „All Decks": echtes Laden, umschaltbare **Grid/Listen-Ansicht**, **Ordner-/Gruppenstruktur**
  (Gruppen anlegen, Decks per Drag/Move einsortieren), einzige „New deck"-Aktion.
- [ ] Deck-Detail-Route `/decks/:deckId` (A3): Kartenliste, Karte hinzufügen/bearbeiten/löschen.
- [ ] **TipTap-Editor** (A8): Fett/Kursiv/Unterstreichen, Überschriften, Listen, Code/Quote;
  **vordefinierte Karten-Templates/Styles** (z.B. lila „Header-Bar"-Preset), Dark/Light-tauglich.
  Speicherung als TipTap-JSON + sanitiertes HTML. (Bild-Upload bewusst noch nicht — A8.)
- [ ] `lib/api.ts`: Group-/Deck-/Card-Funktionen. Mock-Decks entfernen; `selectDueDecks` auf echte Daten.

---

## Phase 3 — FSRS-Lernsession

**Ziel:** Echter Lern-Loop mit FSRS-Scheduling (kein Vermischen von Decks, A4).

- [ ] `services/fsrs.py`: **`py-fsrs`** integrieren (A10); reine Wrapper-Funktionen für
  Bewertungen Again/Hard/Good/Easy → neuer `card_schedule`-State; Property-Tests.
- [ ] `api/review.py` — fällige Karten **pro Deck/Gruppe** laden, Bewertung entgegennehmen,
  `card_schedule` updaten.
- [ ] Frontend: Review-Session-UI (Karte zeigen → umdrehen → bewerten), Querformat-Karten,
  Fortschritt/Streak. Start je Deck oder Gruppe (keine Vermischung über alles).
- [ ] „Review"-Übersicht zeigt fällige Decks; „due"-Logik auf echte `card_schedule.due`-Zeiten.

---

## Phase 4 — KI-Chat (RAG aus Karteninhalten, lokal)

**Ziel:** Assistant wirklich anbinden — Antworten auf Basis der **eigenen Karten** (kein Upload, A11).

- [ ] `services/embeddings.py`: Ollama `nomic-embed-text` (A9). **Karteninhalte** (front/back) werden
  beim Erstellen/Ändern in `document_chunk` eingebettet (Re-Embedding bei Kartenänderung).
- [ ] `services/rag.py`: Retrieval via pgvector-Ähnlichkeitssuche über die Karten-Chunks + Prompt-Aufbau.
- [ ] `services/ai_chat.py` + `api/chat.py`: Streaming-Antwort (qwen3:4b) mit Karten-Kontext.
- [ ] Frontend-Assistant: echtes Senden/Streaming statt Preview; Konversation pro Session erhalten.
- [ ] Bezug zu `*-chat-streaming.md` herstellen/aktualisieren.
- *(Bild-/Dokument-Quellen bewusst ausgeklammert — „für später oder nie".)*

---

## Phase 5 — Sharing & RBAC (vollständiges Rechtesystem)

**Ziel:** Decks per Code/Link teilen mit hierarchischen Rechten (`read` < `edit` < `share`),
inkl. Verwaltung, Zugriffs-Übersicht, Audit und Login-Benachrichtigungen.

- [ ] `api/shares.py`: Share erstellen (Code/Link), einlösen, Rechte **erteilen/ändern/entziehen (revoke)**.
- [ ] Permission-Auflösung serverseitig in **allen** Deck/Card/Review-Endpoints durchsetzen
  (RLS + Service-Checks; `read`<`edit`<`share`).
- [ ] **Audit/Access-Log** (`deck_access_log`): wer hat wann zugegriffen, welche Rechteänderung
  durch wen — für den Owner einsehbar.
- [ ] **Login-Benachrichtigung:** Bei Erteilen/Entziehen von Rechten wird der betroffene Nutzer
  beim **nächsten Login per Popup** informiert (`permission_notification`).
- [ ] **Nav:** neuer Eintrag **„Shared"** — geteilte Decks (mit mir geteilt / von mir geteilt),
  Rechte-Verwaltung und Zugriffs-Übersicht.
- [ ] Frontend: Share-Dialog (Code/Link, Rechte-Auswahl, Revoke), „Shared"-Ansicht, Login-Popup.

---

## Phase 6 — Settings & Feinschliff

- [ ] Settings ausbauen: Profil (Username + **Discriminator**), Theme, Account/Session-Verwaltung
  (`user_sessions`), Logout (bereits da).
- [ ] **Discriminator:** standardmäßig **zufällig** (nicht aufsteigend → nicht erratbar). Nutzer
  darf beim ersten Login einen **eigenen** wählen und später ändern — jeweils mit
  **Verfügbarkeitsprüfung** der Kombination `username#discriminator`.
- [ ] Konsistenz-Pass: Logging/Audit vollständig, Fehlerzustände, Empty-States, A11y-Check,
  finaler Responsive-Pass über alle Seiten.

---

## 5. Abhängigkeiten / Reihenfolge

```
Phase 0 (Fixes) → Phase 1 (DB) → Phase 2 (Gruppen/Decks/Karten) → Phase 3 (FSRS)
                                                                 → Phase 4 (RAG aus Karten)
                                              Phase 5 (Sharing & RBAC)
Phase 6 (Settings/Feinschliff) abschließend.
```
Phase 0 + 1 sind die Grundlage. Phase 4 (RAG) braucht **keinen** Upload — Quellen kommen aus den
Karteninhalten (Phase 2). Phase 5 baut auf dem Permission-Helper aus Phase 1 auf.

---

## 6. Status der Klärungen

- Annahmen A1–A12: final entschieden (Best Practice), alle änderbar.
- Editor/HTML-CSS-Frage: **entschieden** → TipTap + sichere, vordefinierte Karten-Templates statt
  rohem User-HTML/CSS (Begründung in A8).
- FSRS: **`py-fsrs`-Bibliothek** (A10). Datei-Upload: **gestrichen** (A11). Sharing: **volles
  Rechtesystem** (Phase 5). Discriminator: **random + frei wählbar/änderbar** (Phase 6).
- Nächster Schritt nach deiner Abnahme: pro Phase eine umsetzbare Kiro-Spec (beginnend mit Phase 0).

---

## 7. Code-Design / Modul-Seams (verbindlich für alle Specs)

Leitprinzip: **tiefe Module** — viel Verhalten hinter kleinem Interface, an sauberer Seam,
über genau dieses Interface testbar. Konkrete Regeln + Interface-Signaturen pro Phase.

### 7.1 Querschnitt-Regeln
- **Dependencies akzeptieren, nicht erzeugen.** Supabase-Client & Repositories werden per FastAPI
  `Depends` injiziert (nicht via `get_supabase_client()` mitten im Handler). Tests stecken Fakes rein.
- **`api/*` = dünne Adapter** (HTTP ↔ Domäne). Keine DB-Queries/Geschäftslogik im Handler.
  Deletion-Test: löscht man einen Handler, darf nur HTTP-Mapping verloren gehen, keine Logik.
- **Logik in tiefen Services/Repos.** Persistenz hinter Repository-Modulen mit kleinem Interface.
- **Reine Funktionen, wo möglich** (FSRS-Scheduling, Permission-Auflösung, Username-Ableitung,
  Sanitisierung) → über das Interface testbar, Property-Tests.
- **Realer Seam nur bei echter Varianz** (zwei Adapter). Sonst kein Seam einziehen.

### 7.2 Repository-Seam (Phase 1/2)
Pro Domäne ein Repository-Modul; zwei Adapter (Supabase real, In-Memory-Fake für Tests):
```python
class DeckRepo(Protocol):
    def get(self, deck_id) -> Deck | None
    def list_for(self, user_id) -> list[Deck]
    def create(self, owner_id, data) -> Deck
    def update(self, deck_id, patch) -> Deck
    def delete(self, deck_id) -> None
# analog: CardRepo, DeckGroupRepo, ScheduleRepo, ShareRepo
```
RLS bleibt **Defense-in-Depth**, ist aber nicht der Ort der Geschäftslogik.

### 7.3 Permission-Seam (Phase 1, erzwungen ab Phase 2/5) — wichtigste Seam
**Ein** tiefes Modul, überall aufgerufen:
```python
class Permission(Enum): READ; EDIT; SHARE          # read < edit < share
def require_permission(user_id, deck_id, level: Permission) -> None   # raises Forbidden
def resolve_permission(user_id, deck_id) -> Permission | None         # owner > share-Eintrag
```
Versteckt: Owner-Check, Share-Lookup, Hierarchie-Auflösung. Caller lernt einen Aufruf.

### 7.4 FSRS-Seam (Phase 3) — rein
```python
def schedule(state: CardState, rating: Rating, now: datetime) -> CardState   # pure, py-fsrs intern
def is_due(state: CardState, now: datetime) -> bool
```
Persistenz getrennt (`ScheduleRepo`); `api/review.py` bleibt dünner Adapter.

### 7.5 KI-Seams (Phase 4) — echte Varianz Dev/Prod
```python
class ChatModel(Protocol):  def stream(self, messages) -> AsyncIterator[str]
class Embedder(Protocol):   def embed(self, texts: list[str]) -> list[Vector]
# Adapter jetzt: Ollama (qwen3:4b / nomic-embed-text); später: Cloud
def rag_answer(question: str, user_id: str, *, chat: ChatModel, embedder: Embedder) -> AsyncIterator[str]
```
`rag_answer` ist tief: versteckt Retrieval (pgvector) + Prompt-Bau + Streaming. Interface leakt
keine Provider-/Vektor-Details. **Index-Konsistenz** in einem Modul:
```python
def reindex_card(card_id) -> None      # Chunking + Embedding + Upsert
def remove_card_index(card_id) -> None
```

### 7.6 Audit-, Notification- & Content-Seams (Phase 5/2)
```python
def audit_record(event: AuditEvent) -> None                     # versteckt Tabellen-Write
def notifications_pending_for(user_id) -> list[Notification]     # Login-Popup speist sich hieraus
def notifications_mark_seen(user_id, ids) -> None
def sanitize_card_content(input: TipTapJson) -> SafeHtml         # XSS/Allowlist intern (Phase 2)
```

### 7.7 Frontend-Seams
- **`lib/api.ts`** bleibt die einzige Daten-Seam (deck/card/group/review/share/chat-Funktionen);
  Komponenten rufen nie `fetch` direkt. `apiFetch` (Token-Guard + 401-Refresh-Retry) bleibt tief.
- **Pure Helfer** (`due-decks`, `window-bounds`, künftig Gruppen-Baum-Logik) bleiben rein & getestet.
- **`ChatModel`-Pendant im Frontend**: ein `assistantClient` mit kleinem Interface (`send`/`stream`),
  damit die Assistant-UI nicht an Transport-Details hängt.

### 7.8 Test-Disziplin
- Getestet wird **über das Interface** (nie „past the interface"). Repos: Fake-Adapter im Test.
- Reine Module: Property-Tests (FSRS, Permission-Hierarchie, Username, Sanitisierung).

---

## 8. Animations-/Motion-Strategie

- **In-Page-Animation durchgängig mit `motion`** (framer-motion): Landing-Hero-Demo (interaktiv),
  Logo-Intro, OTP-Erfolgssequenz, Assistant-Open/Close, Seitentransitions. Eine Animations-Tech,
  konsistent, GPU-freundlich (`transform`/`opacity`), `useReducedMotion` respektieren.
- **Animiertes USki-Logo** (Landing/Login): leichtgewichtig via `motion` oder SVG/CSS — **kein**
  Remotion.
- **Remotion bewusst NICHT im Scope.** Es rendert echte Videodateien (.mp4) aus React — nur sinnvoll
  für ein späteres, vorgerendertes **Promo-/Erklärvideo** (z.B. eingebettet im unteren Landing-Bereich
  oder für Social Media). Als **optionale spätere Erweiterung** vermerkt, nicht jetzt.
