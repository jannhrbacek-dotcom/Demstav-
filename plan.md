# plan.md — DEMSTAV OPERATIONS (Emergent) — Plan

## 1) Objectives
- Deliver a functional V1 web app (installable PWA) for **DEMSTAV Operations** focused on:
  - **Provozní deník stroje + šichtovnice** (time intervals, MTH, faults, drafts/confirmations, revisions).
  - **Docházka s pracovišti** (arrival/departure/breaks, workplace verification via QR/GPS/manual, exception review flow).
- Implement **email+password auth** with roles: `owner`, `admin` (technický správce), `manager` (vedoucí), `employee`.
  - Admin creates users with **temporary password + forced change on first login**.
  - Owner account is protected (cannot be removed/locked by others) and can deactivate admin.
- Provide **offline-capable core flow** via a persistent per-account local queue (stable IDs, idempotent resend, conflict detection via base revision).
- Provide **file/media attachments** usable in the field (offline-first queue + later sync) and included in exports.
- Provide **service interval tracking & reminders**:
  - Default service interval per machine: **500 mth**; warning threshold: **100 mth**.
  - Current MTH computed as `max(machine.operating_hours, latest records mthEnd/mthStart)`.
  - In-app alerts + optional system notifications.
- Provide **immutability / integrity guarantees** suitable for operational logs:
  - Every saved revision is stored in `record_versions`.
  - Revisions are **hash-chained** (SHA-256 prev_hash + canonical snapshot) including attachment SHA-256.
  - Integrity can be verified via API and shown in UI / printed in diary PDF.
- Provide a **manager overview** so leadership automatically sees synced records: missing timesheets, attendance exceptions, open “STOP” faults, attendance vs timesheet comparison, and new **service alerts**.

## 2) Implementation Steps

### Phase 1 — Core POC (hardest workflow first: offline queue + idempotent sync + conflict handling) ✅ DONE
User stories
1. As an employee, I can create an offline attendance “arrival” event and see it queued with a clear status.
2. As an employee, I can create an offline draft diary record with stable ID and see it queued.
3. As the app, I can resend queued items after reconnect without duplicating data on the server.
4. As a user, I never lose offline data when my session expires; I’m prompted to re-auth and then sync resumes.
5. As the server, I reject conflicting diary updates (wrong base revision) and return a conflict payload.

Scope / Build
- Backend (FastAPI + Mongo):
  - `POST /auth/login`, `POST /auth/change-password` (forced change), `GET /auth/me`
  - Attendance sync with idempotency
  - Revisioned record save with conflict detection
- Frontend POC:
  - Local persistent queue per user (IndexedDB)
  - Sync worker

Exit gate (must pass before Phase 2) ✅ DONE
- Demonstrated: offline create → close/reopen browser → login again → sync → no duplicates → conflict path.

### Phase 2 — V1 App Development (modules + UX), then 1 full E2E test round ✅ DONE
User stories
1. As an employee, I can start my day: arrival → create diary draft → confirm diary, even with weak/absent internet.
2. As an employee, I can enter shift intervals: billing (whole shift), service, downtime, and see totals split correctly.
3. As an employee, I can report a fault with severity “STOP” and later mark it resolved with resolution text.
4. As a manager, I can see today’s exceptions in attendance (pending_review) and approve/reject with audit trail.
5. As a manager, I can see missing timesheets and mismatches (attendance net hours vs timesheet totals).

Backend ✅ DONE
- Auth & roles, seed `owner`, admin endpoints, workplaces, machines, audit.
- Records: draft/confirmed, revisions, conflict 409 payload.
- Attendance: modes `qr/gps/qr_gps/manual`, dynamic QR, manager review.
- Exports: PDF endpoints for šichtovnice and deník.

Frontend (React PWA) ✅ DONE
- Login + forced password change.
- Role-based navigation.
- Employee flows: Attendance + Records (draft/confirm), Queue UI.
- Manager flows: Overview + Review.
- PWA manifest + service worker caching shell.

Testing (end of Phase 2) ✅ DONE
- Full E2E run with seeded users via `testing_agent_v3` (backend 100%, frontend >=95% and later 100% on iteration 2).

### Phase 3 — Hardening + usability improvements ✅ DONE
User stories / work items
- **Jednoduchý režim (Simple Mode)**: bigger UI controls + hide optional sections.
- **Smart autocomplete** + remember last entries in record form.
- **Dictation / voice notes** (Web Speech API cs-CZ) for key text fields.
- **Real pilot data**: created initial workplaces/machines and a temporary admin.

Deliverables ✅ DONE
- Simple mode toggle in UI + persisted to localStorage.
- Smart suggestions (datalist) + “Načíst z minula”.
- Dictation mic buttons in record fields.
- Machines extended specs (manufacturer/year/power/weight/operating_hours/note).
- Temporary admin created:
  - `spravce@demstav.cz` / `qb8cXSWvRr` (**must change password on first login**)
- Real pilot objects in DB:
  - Machines: Liebherr L566, Liebherr L576
  - Workplace: Struskový odval – Lihovarská (QR mode)
- Gemini AI: user explicitly declined for now.
- E2E regression tests via `testing_agent_v3` passed (iteration_2: backend 100%, frontend 100%).

### Phase 4 — Attachments + Service interval notifications + Immutability (in progress) ✅ IMPLEMENTED + TESTED
> This phase was added based on latest user requirements.

#### 4.1 Attachments by section (general/service/timesheet)
User stories
1. As an employee, I can attach photos directly to **servis** section.
2. As an employee, I can attach photos directly to **šichtovnice** section.
3. Exports include/label these attachments correctly.

Backend ✅ DONE
- Attachments metadata now includes `section`: `general | service | timesheet`.
- Attachments are SHA-256 hashed on upload and persisted.

Frontend ✅ DONE
- Record form shows:
  - “Fotky k šichtovnici” uploader (camera capture) → `section=timesheet`.
  - “Fotky ze servisu” uploader (camera capture) → `section=service`.
  - Existing “Přílohy” area remains as `section=general`.

Exports ✅ DONE
- Šichtovnice export pages label attachment appendix pages based on `section`.
- Diary export appends **service** attachments pages.


#### 4.2 Service interval tracking + notifications
User stories
1. As an operator/manager, I see warnings like: **„do dalšího servisu zbývá 100 mth“**.
2. As an operator, I can mark **“Proveden pravidelný servis dle intervalu”** in a confirmed record, which resets the interval from that MTH.
3. As a user, I can optionally enable system notifications.

Backend ✅ DONE
- Machines now support:
  - `service_interval_mth` default 500
  - `service_warn_mth` default 100
  - `last_service_mth` (set when interval service recorded)
- Endpoints:
  - `GET /api/machines` returns computed service status fields: `current_mth`, `next_service_mth`, `remaining_mth`, `service_state`.
  - `GET /api/service-alerts` returns machines with `service_state in (soon, due)`.
- Record confirm: if `intervalService=true`, updates machine `last_service_mth` from record `mthEnd`.
- Manager overview includes `service_alerts`.

Frontend ✅ DONE
- In-app alerts:
  - **Today**: shows ServiceAlerts component.
  - **Manager Overview**: shows service alerts.
  - **Machines list**: shows service status chip.
  - **Record form**: shows service hint based on selected machine and MTH.
- System notifications:
  - Uses Notification API via service worker (notificationclick opens app).
  - Notifies when permission granted and alerts exist (deduped per machine/term).


#### 4.3 Data immutability / integrity
User stories
1. As a company, we can demonstrate that confirmed diary data wasn’t silently changed.
2. As a manager, I can verify integrity for any record.

Backend ✅ DONE
- `record_versions` are now **hash-chained**:
  - `hash = SHA-256(prev_hash + canonical_snapshot)`
  - snapshot includes `attachment.sha256`
- API:
  - `GET /api/records/{rid}/integrity` verifies chain and returns `{ok, broken_at, versions, head}`.

Frontend ✅ DONE
- Record detail page shows:
  - “Integrita ověřena” badge + head SHA-256.
  - Each revision shows short hash prefix.

Exports ✅ DONE
- Diary PDF footer prints record hash markers.

Legal/Compliance note (non-legal advice)
- App provides technical immutability evidence (revision history + hash chain). If strict legal compliance requires qualified timestamps / archival policy, consider adding:
  - eIDAS-qualified timestamping, WORM storage, retention policies, and export archiving.


## 3) Next Actions (immediate)
1. ✅ (Already done) Run `testing_agent_v3` on end-to-end flows including new Phase 4 features.
2. Deploy/verify pilot data entry:
   - Admin logs in and enters **full list of machines + workplaces**.
3. Operationalize notifications:
   - Decide whether to require user opt-in (recommended) and set org policy.
4. Optional hardening:
   - Add periodic server-side verification job (daily) to flag any integrity breaks.
   - Add export stamp page with integrity head hash list for archival.

## 4) Success Criteria
- Core flow works end-to-end: employee records attendance + diary (online/offline) → sync → manager sees them automatically.
- Offline queue persists across reload and session expiry; no silent data loss.
- Idempotent resend: repeated sync does not duplicate attendance or diary records.
- Diary revisions enforce conflict detection and provide a usable conflict resolution UI.
- Work-time calculations match defined rules (service inside shift counts within total; downtime separate; overnight handled).
- Attendance verification stores only derived GPS results (no coordinates), supports QR/GPS/manual modes, and exceptions are reviewable with audit.
- Attachments can be captured in the field and are exported correctly (general/service/timesheet).
- Service interval reminders show in-app and optionally via system notifications.
- Immutability: record version history + hash-chain integrity verification works and is visible in UI/PDF.
