# Virtual PO Box — Work Log

Project: A private "slow mail" letter app. Each user gets an anonymous box ID (e.g. `box-7k2m9q4x`). Anyone who knows the ID can send a letter; only the box owner can read their inbox. Letters are sealed until opened, with a delivery delay for ritual/anticipation.

## Architecture (adapted to sandbox stack)

- **Framework**: Next.js 16 App Router + TypeScript (required).
- **DB**: Prisma + SQLite (plan said Postgres; SQLite is the sandbox default and fine for the MVP).
- **Auth**: email + password (plan said email magic links are "free and just as secure"; sandbox can't send real email, so a password is the practical "something you know" second factor beyond the email identifier). Sessions stored in DB, httpOnly cookie carries the session token.
- **File storage**: local `uploads/` folder under random keys (plan said private object storage; local is the sandbox equivalent). All downloads go through an auth-checked API route — no public links.
- **Box ID format**: `box-` + 8 chars from the unambiguous alphabet `23456789abcdefghjkmnpqrstuvwxyz` (30^8 ≈ 656 billion combos — unguessable).
- **Delivery delay**: 120s for the demo (plan said "a few hours"; sped up so the feature is observable in one session). Shown honestly in the UI.

## Security rules (enforced server-side, not just UI)

- Inbox query: `WHERE recipientBoxId = currentUser.boxId`.
- Sent query: `WHERE senderBoxId = currentUser.boxId`.
- Read letter / download attachment: caller must be the sender OR recipient of that exact letter — never fetch by ID alone.
- No endpoint lists boxes or confirms whether a box exists. Sending to a nonexistent box silently produces no inbox entry (the sender still sees their sent copy; that is fine and avoids leaking box existence).
- Rate-limit signup, login, and send attempts.

## Build order (from the plan, 1–4 this MVP; 5 encryption deferred)

1. Auth + box creation
2. Send text letters + inbox + sent
3. Delivery delay + "letter arrived" notification (polling + toast in this build)
4. File attachments
5. Encryption — deferred (plan: "only if privacy is the main selling point")

## API contract (locked — frontend builds against this)

All routes under `/api`. Auth via httpOnly cookie `pobox_session`.

- `POST /api/auth/signup` `{ email, password }` → `200 { user:{id,email}, boxId }` | `409` email taken | `400` validation | `429` rate-limited
- `POST /api/auth/login` `{ email, password }` → `200 { user:{id,email}, boxId }` | `401` bad creds | `429`
- `POST /api/auth/logout` → `204`
- `GET  /api/auth/me` → `200 { user:{id,email}, boxId }` | `401`
- `GET  /api/letters?box=inbox|sent` → `200 { letters: LetterListItem[] }` | `401`
  - LetterListItem: `{ id, senderBoxId, recipientBoxId, preview, sentAt, deliverAt, openedAt, attachmentCount }`
- `POST /api/letters` `{ recipientBoxId, body, attachmentIds: string[] }` → `201 { letter }` (deliverAt = now+120s) | `400` | `401` | `429`
- `GET  /api/letters/[id]` → `200 { letter: LetterDetail }` | `403` not a party | `401`
- `PATCH /api/letters/[id]` `{ opened: true }` → `200` (recipient only) | `403`
- `POST /api/uploads` multipart `file` → `201 { id, filename, mimeType, size, storageKey }` | `400` too big/bad type | `401`
- `GET  /api/attachments/[id]` → streams file | `403` not sender/recipient | `401`

LetterDetail: `{ id, senderBoxId, recipientBoxId, body, sentAt, deliverAt, openedAt, attachments: Attachment[] }`
Attachment: `{ id, filename, mimeType, size }`

## Design vision: "Slow Mail / The Post Room"

Warm parchment paper, deep ink text, crimson wax-seal accents, muted gold. Serif (Lora) for letter bodies + headings, Geist for UI chrome. Letters look like envelopes; unread = sealed wax seal you tap to break. Compose on lined paper. Anticipation, not instant messaging.

Palette (light = primary):
- background parchment `oklch(0.96 0.012 85)`, foreground ink `oklch(0.22 0.03 50)`
- card paper `oklch(0.98 0.008 85)`, primary wax crimson `oklch(0.50 0.17 25)`, accent gold `oklch(0.72 0.10 80)`
Dark "lamplight" theme: deep warm brown background, same paper cards.

---
Task ID: 1
Agent: main (orchestrator)
Task: Set up the plan, worklog, and Prisma schema; push to DB.

Work Log:
- Read the uploaded plan at /home/z/my-project/upload/letter-app-plan.md.
- Inspected existing scaffold (Next.js 16, Prisma+SQLite, shadcn/ui New York, full component set).
- Adapted the plan to the sandbox stack (SQLite instead of Postgres, local uploads instead of object storage, email+password instead of magic links, 120s delivery delay for the demo).
- Locked the API contract above so any later agent work is consistent.
- Started dev server on port 3000 in the background.

Stage Summary:
- Plan + API contract + design vision locked in this worklog.
- Proceeding to write the Prisma schema (User/Session/Letter/Attachment) and push to the DB, then lib helpers, then backend APIs, then frontend.

---
Task ID: 2-3
Agent: main (orchestrator)
Task: Build all lib helpers and backend API routes; verify end-to-end.

Work Log:
- lib/crypto.ts: scrypt password hashing (format scrypt$N$r$p$salt$hash), randomToken (32B hex), hashToken (sha256), timingSafeEqual verify.
- lib/box.ts: box- + 8 chars from unambiguous alphabet (30^8 ≈ 656B combos), rejection-sampled randomBytes, isValidBoxId, boxIdEquals (constant-time).
- lib/ratelimit.ts: in-memory sliding-window limiter with purge + LIMITS presets (signup/login 5-10/hr/ip, send/upload 20-30/hr/user).
- lib/session.ts: cookie pobox_session (httpOnly, sameSite=lax, secure in prod, 30d), createSession stores hashed token, getUser resolves + prunes expired, enforceLimit helper, getClientIp via X-Forwarded-For.
- lib/types.ts: shared response types (UserPublic, MeResponse, LetterListItem, LetterDetail, AttachmentPublic).
- lib/uploads.ts: allowlist of MIME+ext (images/pdf/docx/txt/audio), 10MB/file, 5 files/letter, persistFile under random hex keys, resolveStoragePath with strict hex regex + path-traversal containment.
- lib/letter.ts: toDetail/toListItem mappers; DELIVERY_DELAY_MS = 120000 (2 min, demo).
- API routes: signup, login (dummy-hash to avoid enumeration), logout, me; GET/POST /api/letters (inbox filters deliverAt<=now; sent returns all incl. in-transit; POST is multipart creating letter+attachments with file cleanup on failure); GET/PATCH /api/letters/[id] (party-check + arrival-check); GET /api/attachments/[id] (party-check + forced download, no-store, nosniff).

Stage Summary:
- E2E verified via curl: alice & bob signups produce box ids; alice sends to bob (201); alice's sent list shows the letter; bob's inbox is EMPTY until deliverAt (2 min) — the delivery delay is real and enforced server-side; bad box id → 400.
- Security: every read/download checks sender-or-recipient membership + arrival; no box directory endpoint exists; recipient cannot read pre-arrival mail.
- Next: frontend (design system + auth screen + shell + lists + compose + reader + arrival polling).

---
Task ID: 4-10
Agent: main (orchestrator)
Task: Build the design system and the entire frontend (auth, shell, lists, compose, reader, arrival polling).

Work Log:
- globals.css: "parchment" light theme (cream bg, ink text, wax-crimson primary, gold accent, sepia muted) + "lamplight" dark theme (warm brown). Added `.paper` / `.paper-lined` (lined writing paper) / `.wax-seal` (radial-gradient crimson disc w/ emboss) / `.postmark-ring` / `.letter-prose` (serif) / `.scroll-letter` utilities + a subtle paper-grain body background.
- layout.tsx: Lora serif + Geist fonts, letter-app metadata, Providers (ThemeProvider + React Query client, defaultTheme light).
- lib/api.ts: typed client w/ ApiError; signup/login/logout/me/inbox/sent/letter/open/send (multipart); attachmentUrl helper.
- store/auth.ts (zustand): status/me/justSignedUpBoxId; init/login/signup/logout; the signup celebration flag drives BoxReveal.
- lib/time.ts: relTime/fullTime/clockTime/countdown (date-fns).
- Components (src/components/letter):
  - WaxSeal: crimson disc w/ quill emblem + embossed ring; `breaking` runs scale+crack(SVG pathLength)+fade.
  - BoxIdChip: copyable box-id chip (KeyRound + mono + copy/check feedback).
  - ThemeToggle: light↔lamplight via next-themes.
  - LetterCard: envelope card. States: sealed (wax seal, "tap to break"), opened, transit (postmark + live countdown), delivered-sealed/opened. Flap band + centered seal at flap/body boundary + from/to + preview + meta.
  - LetterList: React Query polling (inbox 8s / sent 15s), "a letter arrived" toast on new inbox ids (after first fetch), loading skeletons, empty states.
  - Compose: lined-paper textarea (serif), recipient box-id field w/ validation + "Send to my own box" helper, client-side file validation mirroring the server allowlist, attachments chips, "Seal & send" w/ spinner + invalidates queries.
  - LetterReader: full-screen overlay; recipient-sealed letters show a large wax seal + "tap to break the wax"; on tap → api.open + invalidate + reveal body (blur→clear). Sender always sees body + recipient-open status. Attachments download via auth-checked /api/attachments/[id]. Esc to close.
  - BoxReveal: one-time celebration overlay after signup (big wax seal + box id + copy + Enter).
  - AuthScreen: hero (wax seal, "PO Box", tagline, 3 how-it-works bullets) + segmented login/signup tabs (layoutId pill) + email/password form.
  - AppShell: sticky header (brand wax-seal mark + BoxIdChip + Compose + ThemeToggle + logout), Inbox/Sent tabs with live counts (layoutId pill), AnimatePresence view switching, sticky footer (mt-auto) with attribution + delay note, reader + BoxReveal overlays.
- page.tsx: orchestrates loading → AuthScreen (unauthed) → AppShell (authed) via the zustand store init().

Stage Summary:
- Full app wired: signup→BoxReveal→inbox/compose/sent→(wait ~1min)→sealed inbox letter→tap→seal breaks→body. Polling toasts "A letter arrived". Dark/lamplight toggle. Sticky footer. Responsive header (box chip wraps to its own line on mobile).
- DELIVERY_DELAY_MS = 60_000 (1 min) so the full ritual is observable in one session; UI copy updated to "about a minute" / "~1 min".
- Lint clean. Next: agent-browser end-to-end verification of the golden path + responsiveness + sticky footer.

---
Task ID: 11
Agent: main (orchestrator)
Task: End-to-end verification with Agent Browser + fixes.

Work Log:
- Loaded the agent-browser skill, opened http://localhost:3000/.
- Auth screen rendered correctly (PO Box hero, Create a box / Log in segmented tabs, email+password, "Create my box" disabled correctly until valid).
- Signed up demo@pobox.dev → BoxReveal showed the box id (box-b38anhvp) once, with Copy + Enter my box.
- AppShell rendered: header (wax-seal brand mark, copyable BoxIdChip, Compose, ThemeToggle, Log out), Inbox/Sent tabs with live counts, empty inbox state.
- Compose: "Send to my own box" helper filled recipient; lined-paper textarea; "Seal & send" enabled only when recipient valid + (body or files). Sent → toast "Letter sealed and sent ✉ — It's on its way. Arrives in about a minute." → view switched to Sent (count 1).

BUGS FOUND & FIXED during verification:
1. Parse error: src/store/auth.ts was missing a closing paren at the zustand create() call (`});` → `}));`). Fixed.
2. Client crash on seal-break: LetterReader.breakSeal() double-wrapped the React Query cache — api.open returns {letter: LetterDetail} but I setQueryData(..., {letter: updated}), so q.data.letter.attachments became undefined → .length threw. Fixed to setQueryData(..., updated). Re-tested: fresh sealed letter → break wax → body revealed, "Opened X ago", no error.
3. Self-addressed letter showed the recipient "Sealed" view in the Sent list (both roles true, recipient branch won). Refactored LetterCard to take an explicit role: "sender"|"recipient" (inbox→recipient, sent→sender). Sent list now correctly shows "TO box-x · In transit · Xs to arrival" for self-sends. Also suppressed the redundant "Delivered · still sealed by recipient" sender-status row when the viewer is also the recipient.

VERIFIED GOLDEN PATH (Agent Browser):
- signup → box-id reveal → enter box (empty inbox)
- compose to own box → seal & send → toast → Sent shows "In transit" + live countdown
- (wait ~1 min) → polling moves the letter into Inbox as a sealed envelope; tab count updates; "A letter arrived" toast fires on new arrivals
- tap sealed letter → reader overlay with large wax seal + "tap to break the wax"
- tap seal → wax cracks + fades, body revealed, "Opened less than a minute ago", card flips to opened/preview/"read"
- already-opened letter re-opens directly with body (no seal)
- ThemeToggle: light ↔ lamplight dark (html class switches); layout + contrast hold in dark
- Responsive: 390×844 mobile header wraps (brand+actions row, box-id chip on its own line, cards stack 1-col); 1280×800 desktop 3-col grid
- Sticky footer: footer bottom == window.innerHeight on both mobile (844=844, gap 0) and desktop (800=800, gap 0) — sticks on short pages, no floating gap, no overlap with cards
- bun run lint: clean. dev.log: no runtime errors after fixes.

Stage Summary:
- Five screenshots captured (empty inbox, reader-revealed, dark inbox, mobile inbox, desktop inbox) under /home/z/my-project/screenshot-*.png.
- The app is fully runnable and interactive end-to-end in the preview. Done.
