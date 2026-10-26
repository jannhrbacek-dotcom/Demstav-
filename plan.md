# plan.md — DEMSTAV OPERATIONS (Emergent) — Plan

## 1) Objectives
- Deliver a functional V1 web app (installable PWA) for **DEMSTAV Operations** focused on:
  - **Provozní deník stroje + šichtovnice** (time intervals, MTH, faults, drafts/confirmations, revisions).
  - **Docházka s pracovišti** (arrival/departure/breaks, workplace verification via QR/GPS/manual, exception review flow).
- Implement **email+password auth** with roles: `owner`, `admin` (technický správce), `manager` (vedoucí), `employee`.
  - Admin creates users with **temporary password + forced change on first login**.
  - Owner account is protected (cannot be removed/locked by others) and can deactivate admin.
- Provide **offline-capable core flow** via a persistent per-account local queue (stable IDs, idempotent resend, conflict detection via base revision).
- Provide a **manager overview** so leadership automatically sees synced records: missing timesheets, attendance exceptions, open “STOP” faults, attendance vs timesheet comparison.

## 2) Implementation Steps

### Phase 1 — Core POC (hardest workflow first: offline queue + idempotent sync + conflict handling)
User stories
1. As an employee, I can create an offline attendance “arrival” event and see it queued with a clear status.
2. As an employee, I can create an offline draft diary record with stable ID and see it queued.
3. As the app, I can resend queued items after reconnect without duplicating data on the server.
4. As a user, I never lose offline data when my session expires; I’m prompted to re-auth and then sync resumes.
5. As the server, I reject conflicting diary updates (wrong base revision) and return a conflict payload.

Scope / Build
- Backend (FastAPI + Mongo): minimal endpoints for
  - `POST /auth/login`, `POST /auth/change-password` (forced change), `GET /auth/me`
  - `POST /sync/attendance-events` with **idempotency key**
  - `POST /sync/diary-upsert` supporting `{id, baseRevision, payload}` and returning `{revision}` or `{conflict}`
- Frontend POC page:
  - Create offline attendance + diary items
  - Local persistent queue per user (IndexedDB or localforage)
  - Sync worker (manual “Sync now” + background on connectivity)
- Conflict rules (MVP):
  - Attendance: append-only; idempotent by `(employeeId, localId)`.
  - Diary: revisioned; accept only if `baseRevision == currentRevision` else return `409` with current server payload.

Websearch checkpoint (best practice)
- Quick web research on: “IndexedDB queue idempotency key offline sync conflict resolution patterns” and “FastAPI idempotency key design”.

Exit gate (must pass before Phase 2)
- Demonstrate: offline create → close/reopen browser → login again → sync → no duplicates → conflict path shown.

### Phase 2 — V1 App Development (modules + UX), then 1 full E2E test round
User stories
1. As an employee, I can start my day: arrival → create diary draft → confirm diary, even with weak/absent internet.
2. As an employee, I can enter shift intervals: billing (whole shift), service, downtime, and see totals split correctly.
3. As an employee, I can report a fault with severity “STOP” and later mark it resolved with resolution text.
4. As a manager, I can see today’s exceptions in attendance (pending_review) and approve/reject with audit trail.
5. As a manager, I can see missing timesheets and mismatches (attendance net hours vs timesheet totals).

Backend
- Auth & roles
  - Collections: `users`, `workplaces`, `attendance_events`, `attendance_audit`, `diary_records` (versioned), `machine_catalog` (simple)
  - Seed `owner` from env; protect from reset/deactivation except by itself.
  - Admin endpoints: create user (temp password), deactivate/reactivate, reset password, assign role + workplaces.
- Diary (Provozní deník + šichtovnice)
  - Data model aligned to provided source `RecordEntry` (draft/confirmed, revision, correctionReason).
  - Time rules: port `timeBreakdown` logic (shift mode totals, overnight handling, downtime minus service overlap).
  - “Jízda*”: numeric input stored as string/number (no derived meaning; label kept).
- Attendance
  - Workplace: mode `qr/gps/qr_gps/manual`, qr static/dynamic; dynamic QR = HMAC-signed 120s token.
  - GPS stored as result/distance/accuracy (no coordinates persisted).
  - Event state machine: arrival/departure/break_start/break_end; pending_review reasons: offline/gps_outside/gps_inaccurate/qr_invalid/manual/etc.
  - Manager review: approve/reject with audit record.
- Manager overview API
  - Missing timesheets per employee/day
  - Pending attendance reviews
  - Open STOP faults
  - Attendance vs timesheet comparison (union-of-spans per employee; no double counting across machines)

Frontend (React PWA)
- App shell
  - Login + forced password change flow
  - Role-based navigation: Employee vs Manager/Admin vs Owner
  - PWA manifest + service worker caching for shell; offline banner + sync status.
- Employee flows
  - Attendance: big buttons (arrival/break/departure), workplace selection, QR scan input (manual entry for MVP), GPS capture on tap.
  - Diary form: 13-column timesheet fields + extended diary fields (faults, checks, fluids, notes, handover) + confirm action.
  - Local queue UI: “waiting / sent / conflict / needs login”.
- Manager flows
  - Dashboard: cards for pending attendance reviews, missing timesheets, STOP faults.
  - Attendance review screen: per event approve/reject + reason.

Data sync (V1)
- Shared sync engine for attendance + diary
  - Persistent queue per userId
  - Idempotency keys for POSTs
  - Retry with backoff; pauses on 401 until re-login
  - Conflict UI for diary: show server vs local and allow “overwrite” (new revision) or “discard local”.

Testing (end of Phase 2)
- One full E2E run with seeded users:
  - employee offline create events + diary → reconnect → sync → manager sees records → approve exception → diary conflict test.

### Phase 3 — Hardening + coverage (still within V1 scope), then 1 full E2E test round
User stories
1. As an employee, I can work overnight shift intervals and totals remain correct.
2. As an employee, I can record two machines in one day without double counting my time in manager reports.
3. As a manager, I can export a basic CSV (not PDF/XLSX) for a selected date range (internal use).
4. As an admin, I can revoke access immediately and the next sync fails safely without deleting local drafts.
5. As an owner, I can deactivate an admin and confirm audit remains intact.

Work items
- Tighten validation and server-side authorization for all resources.
- Add automated tests (backend):
  - work-time breakdown edge cases (overnight, overlaps)
  - attendance state machine + review
  - diary revision conflicts
- Improve offline resiliency:
  - queue compaction, visibility, manual “resync all”
  - clear per-account separation

### Phase 4 — Future (post-V1; not required now)
- PDF/XLSX exports aligned to original templates.
- Machine register + service intervals + reminders.
- Attachments (photos/docs) + offline attachment queue.
- “Technik v kapse” AI module.

## 3) Next Actions (immediate)
1. Add backend auth (email/password JWT) + seed owner/admin; implement forced password change.
2. Implement POC sync endpoints (attendance append + diary revisioned upsert + idempotency).
3. Implement frontend local queue (IndexedDB) + sync worker + minimal UI.
4. Run Phase 1 exit-gate demo; fix until stable.
5. Build full Phase 2 screens (employee diary + attendance; manager overview + review) and run E2E test round.

## 4) Success Criteria
- Core flow works end-to-end: employee records attendance + diary (online/offline) → sync → manager sees them automatically.
- Offline queue persists across reload and session expiry; no silent data loss.
- Idempotent resend: repeated sync does not duplicate attendance or diary records.
- Diary revisions enforce conflict detection and provide a usable conflict resolution UI.
- Work-time calculations match defined rules (service inside shift counts within total; downtime separate; overnight handled).
- Attendance verification stores only derived GPS results (no coordinates), supports QR/GPS/manual modes, and exceptions are reviewable with audit.
