# V11 — My Projects + account-saved progress

## Added
- A horizontal **My Projects** rail above the project library.
- Opening an RFP automatically marks it as started.
- Saved projects show their latest test state, including `x/y tests passed`.
- Users can reopen any attempted project and continue with the saved design and notes.
- Users can remove a project from My Projects without deleting the project from the library.
- Project progress is stored in the signed-in user's Supabase account and mirrored to browser local storage as a fallback.
- Existing browser-only V10 saves are migrated into the account automatically when possible.
- Slider changes, material changes, and engineering notes autosave after a short delay.

## Database
Uses `public.project_progress` with row-level security so authenticated users can only read/write/delete their own project progress.
