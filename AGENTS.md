# InstructorOS - Codex Notes

This is a separate copy of the SparkOn Driving Academy instructor app.

## Project

- Framework: Next.js 15 app router
- Main app folder: `src/app`
- Shared types: `src/lib/types.ts`
- Firebase hooks: `src/hooks`
- Live domain: `https://instructoros.ca`
- GitHub repo: use a new repository, not `mansuriyasu/sparkon-instructor-pro`.
- Main branch: `main`

## Common Commands

- Start locally: `npm run dev`
- Production build: `npm run build`
- Type check: `npm run typecheck`

The local dev server uses port `9002`.

## Deployment

Push changes to the new repository's `main` branch. Hostinger or the hosting provider should deploy from that new repository only.

Before pushing, run:

```bash
npm run build
```

Build warnings from Genkit/OpenTelemetry and the Firebase config fallback have been seen before and are not usually caused by normal app edits. The build should still finish successfully.

## Important App Areas

- Home menu: `src/app/(dashboard)/_components/home-menu.tsx`
- Students/contacts: `src/app/(dashboard)/_components/student-grid.tsx`
- Student popup: `src/app/(dashboard)/_components/student-details-dialog.tsx`
- Add/edit student form: `src/app/(dashboard)/students/form/_components/student-form.tsx`
- Schedule: `src/app/(dashboard)/schedule/_components`
- Payments/POS: `src/app/(dashboard)/payments`
- Payment history: `src/app/(dashboard)/payments/history`
- Expenses: `src/app/(dashboard)/expenses`
- iPhone license shortcut endpoint: `src/app/api/shortcuts/license-scan/route.ts`

## Product Preferences

- Mobile usability matters most.
- Keep buttons compact on schedule cards and popups.
- Prefer Waze links for navigation on iPhone.
- Keep payment, schedule, and student records connected.
- If changing database fields, update import/export if needed.

## Branding

InstructorOS is a multi-tenant platform. Never hardcode a customer name (e.g. SparkOn) in user-visible output; branding comes from tenant settings (`receiptBusinessName`, `receiptFooterText`, logo fields) with `InstructorOS` as the neutral fallback.

## Secrets

Do not commit `.env` or real secret values. Use fresh environment variables for this copy.
