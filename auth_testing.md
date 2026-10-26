# Test credentials (DEMSTAV OPERATIONS)
- Owner (seeded from backend/.env OWNER_EMAIL/OWNER_PASSWORD): vlastnik@demstav.cz / Demstav2026!  role: owner
- Other users: created by owner/admin in /uzivatele (POST /api/users) -> returns temporary_password; first login forces POST /api/auth/change-password
## Auth endpoints
- POST /api/auth/login {email,password} -> {access_token,user}  (Bearer token)
- GET /api/auth/me, POST /api/auth/change-password {current_password,new_password}
- Users: GET/POST /api/users, PATCH /api/users/{id}, POST /api/users/{id}/reset-password
