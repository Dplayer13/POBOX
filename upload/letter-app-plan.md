# Virtual PO Box Letter App: Build Plan

## Idea
A private app where each person gets a unique, anonymous virtual PO box. People send letters (text and files) to a box ID. Only the box owner can read what arrives in their box.

## Core rules
- **Box ID:** random and anonymous, e.g. `box-7k2m9q4x`. Use a long code, not 4 digits (`box-4821` has only 10,000 combinations and is guessable).
- **Box owner:** reads everything in their own inbox and sees their own sent letters.
- **Anyone else:** can send a letter to a box if they know its ID, and can see only the letters they sent. They can never list, open, or search another box.
- **No box directory:** no endpoint lists boxes or confirms whether a box exists.
- **Sharing:** your box ID is shared by you directly with the person you want letters from.

## Login
- Signing up creates a box. The ID is shown once.
- Phone number is the key to open your own box, but the number alone never opens anything. Always require a one-time code (OTP), especially on a new device.
- Numbers get recycled, so the OTP check protects against someone inheriting an old number.
- Cost note: SMS OTP costs money per message and delivery can be unreliable. For the first version, email magic links are free and just as secure. Add phone login later.
- Addressing is separate from login: letters are sent to a **box ID**, never to a phone number.

## Architecture
- **Backend:** FastAPI + Postgres (Supabase optional, gives auth for free)
- **Frontend:** installable web app (PWA), no app store
- **Hosting:** Render
- **File storage:** private object storage (Cloudflare R2, Supabase Storage, or S3). Never store files in Postgres.

## Data model
- `users`: id, phone, created_at
- `boxes`: id (`box-xxxxxxxx`), user_id
- `letters`: id, sender_box, recipient_box, body, sent_at, deliver_at, opened_at
- `attachments`: id, letter_id, filename, mime_type, size, storage_key

Design `body` so it can later hold ciphertext without a rewrite.

## Letter behavior
- Plain text editor styled like paper.
- Letters are locked after sending (no editing).
- Delivery delay: a letter "arrives" a few hours after sending.
- Unread letters appear sealed; tap to open.
- Notification: "A letter arrived" by email or web push.

## Files
- Bucket is private. No public links.
- Flow: app asks server to upload, server checks size and type, then gives a short-lived upload URL, and the file goes straight to storage.
- Download: server first checks the user is the letter's sender or recipient, then gives a link that expires in a few minutes.
- Limits from day one: e.g. 10 MB per file, 5 files per letter.
- Allow a list of types (images, PDF, docx, audio). Block executables.
- Store files under random keys, not original names.
- Scan uploads for malware if possible, and never open or render them on the server.

## Server-side security rules (not just UI)
- Every query filters by the logged-in user's box:
  - Inbox: `WHERE recipient_box = current_user.box_id`
  - Sent: `WHERE sender_box = current_user.box_id`
- Never fetch a letter or file by ID alone.
- Rate-limit sending and login attempts so box IDs can't be guessed.

## Build order
1. Auth + box creation
2. Send text letters + inbox + sent
3. Delivery delay + "letter arrived" notification
4. File attachments
5. Encryption of letter bodies and files (only if privacy is the main selling point)

## Watch-outs
- **Real risk:** the app only works if both people actually use it. Build the MVP in a weekend, use it for two weeks, then add features.
- **Storage costs and abuse** grow with strangers signing up. Set limits now.
- **Encryption trade-offs:** files are harder to encrypt than text. If encrypted so only the recipient can read, the sender can't re-read their sent copy unless a second copy is encrypted for them. Decide early, because it changes the design.
- **Push notifications:** limited on iPhone unless the app is installed to the home screen. Email alerts are the safe fallback.

## Open decisions
- Login method for v1: email magic links (free) or phone OTP (costs per SMS)?
- Just the two of you, or open to other signups later?
- Is encryption a launch feature or a later one?
