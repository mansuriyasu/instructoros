# InstructorOS Production Readiness

Use this checklist before pushing a deployment to the live domain.

## Required Checks

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run build`.
- Confirm the Admin > Production readiness panel has no missing required items.
- Deploy `firestore.rules` to the new Firebase project.
- Rotate any live Stripe secret key that was shared outside Stripe, then update hosting environment variables.
- Confirm Hostinger or the hosting provider uses the new InstructorOS repository and not the old SparkOn repository.

## Firebase Auth Setup

In the Firebase project used by InstructorOS:

- Open Firebase Console > Authentication > Sign-in method.
- Enable **Email/Password** and save.
- Enable **Google**, choose a project support email, and save.
- Open Authentication > Settings > Authorized domains.
- Add `instructoros.ca`, `www.instructoros.ca`, and `localhost` for local testing.
- Reopen `/admin` and confirm the Production readiness panel shows Email/password auth and Google auth as ready.

## Firebase Role Tests

Test these with real accounts in the new Firebase project:

- Main admin can open `/admin`, view tenants, and open a tenant workspace.
- School admin can invite instructors, manage all students, manage all schedules, and update billing.
- School instructor can only see assigned students, schedules, and payments.
- Individual instructor can manage only their own workspace.
- A disabled instructor cannot access the school workspace.
- A billing-locked workspace can read records but cannot create or update tenant data.

## Stripe Tests

- New individual instructor signup starts the free-month checkout.
- New school signup starts the free-month checkout.
- Stripe webhook unlocks the workspace after checkout session completion.
- Cancelling or failed payment locks the workspace as expected.
- School extra seats update the subscription quantity.

## Domain Tests

- `https://instructoros.ca` loads the marketing homepage.
- `https://instructoros.ca/login` loads login/signup.
- OAuth redirects return to the InstructorOS domain.
- The old SparkOn app and domain remain unchanged.
