# InstructorOS mobile notifications

## Architecture

The Next.js app stays on Hostinger. Firebase Functions (codebase `notifications`, Node 22, northamerica-northeast2) process Firestore business events alongside the Toronto database. The two Cloud Scheduler jobs run in Montréal (`northamerica-northeast1`), the nearest supported region. FCM sends data-only Web Push; the root-scope worker displays one notification and validates its ID before opening the authenticated notification resolver. No APNs certificate, App Store app, Twilio message, or Apple developer subscription is required for Web Push.

All new notification collections are server-only, including for platform-admin browser sessions. `/api/notifications` verifies a Firebase ID token, resolves the user's stored active workspace, and checks active membership. It never accepts tenant or recipient IDs from the caller. Entity access is rechecked for inbox reads, clicks, and delivery. Settings are personal within a workspace. Changing membership/assignment takes effect at the next server check. An already delivered lock-screen message cannot be recalled remotely.

Collections:
- `staffNotifications`: one deterministic ID per business event, workspace and recipient, with personal read state.
- `notificationPreferences`: per workspace/user master switch, categories and reminder timing.
- `pushDevices`: token-hash IDs, installation IDs, ownership, enabled state and last seen; up to ten installations per user.
- `notificationJobs`: durable due time, attempts, worker lease and expiry.
- `notificationDeliveries`: per-device success markers to avoid resending successful devices on retry.
- `notificationRateLimits`: persistent limits for settings/device/test actions.

The existing tenant registration record is retained as the source event. Existing registration history (latest 50, within 90 days) is copied to each authorized user's inbox once without push. Birthdays and licence alerts remain in the bell. The inbox is shared by all bell instances in the page, checks every two minutes only while visible, and refreshes on focus, opening, or foreground push.

## Business events

Registration, student portal availability changes, meaningful schedule updates/cancellations, and recorded payment increases create notifications. Google Calendar ID bookkeeping does not. Actor-stamped schedule/payment changes omit the actor from alerts. Payments default to push off. Deleted events open their schedule day. Road tests use the existing student `roadTest` fields, with 7-day, 1-day and same-day reminders at 07:00 Toronto time. No AI jobs or student-facing push are added.

Lesson reminders use the existing event instructor and start time, with Off/15/30/60 minute preferences. A one-minute scheduled worker processes up to 100 due jobs with five concurrent deliveries; the daily horizon seeds existing near-term events and road tests. Changed start times, cancelled lessons, changed assignments and disabled preferences invalidate pending reminders at delivery. Immediate jobs also have a Firestore trigger. Failed delivery leaves the inbox intact and retries up to five times. Provider acceptance is not proof that a person saw an alert, and exactly-once push delivery cannot be guaranteed after network failures.

## Configuration and deployment

1. Firebase Console > Project Settings > Cloud Messaging: enable FCM HTTP v1 and create a Web Push key pair. Enable the FCM Registration API if necessary.
2. Hostinger environment: set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` to the public key and rebuild. Existing `NEXT_PUBLIC_FIREBASE_*` fields are public client configuration. Existing `FIREBASE_*` Admin credentials stay server-only. Never put private credentials in the worker, manifest or repository.
3. Enable Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc and Cloud Scheduler APIs. Use the dedicated `instructoros-notifications` service account with Datastore User and Firebase Cloud Messaging API Admin permissions. Eventarc also needs event receiver/invoker permissions for event delivery.
4. Run `npm ci` and `npm --prefix functions ci`, then the checks below.
5. Deploy `firebase deploy --only firestore:indexes,firestore:rules --project instructoros`. Wait for indexes to finish building before releasing the app.
6. Deploy `firebase deploy --only functions:notifications --project instructoros`. This is a separate deploy from Hostinger's GitHub deployment. Confirm scheduler jobs and function health. Set Artifact Registry cleanup so old build images do not accumulate.
7. Push the app commit to main and verify the Hostinger deployment. Confirm `/manifest.webmanifest`, `/firebase-messaging-sw.js`, icons and `/offline.html` return successfully over HTTPS without authentication redirects.
8. Test with one staff account before enabling on other devices. No existing user is automatically opted into push.

Firestore TTL removes inbox/device records after 90 days of retention/inactivity and delivery jobs/markers after 7 days (road-test jobs 10 days). TTL is asynchronous and incurs document deletes. Retain production business records independently. FCM messaging itself has no usage charge; Functions, Scheduler, Firestore reads/writes/TTL and build artifacts can incur charges. Jobs use zero warm instances, bounded concurrency and indexed due queries, not full database scans every minute.

Rollback: disable push preferences or pause the two scheduler jobs; deploy the previous web release if needed. Keep the public worker available so existing installations can update. Do not delete student, payment, event or availability records during rollback.

## Verification

```sh
npm run typecheck
npm run lint
npm run security:check
npm run build
npm --prefix functions test
firebase emulators:exec --config firebase.notifications-test.json --only firestore --project demo-instructoros-notifications 'npm --prefix functions test'
```

The emulator test requires Java 21+. It tests assignment/tenant isolation, server-only rules (including the catch-all admin rule), concurrent deduplication, provider failure, token cleanup, preferences, inactive membership and stale reminders. FCM is mocked, never sent to a real device by these tests. Running without the emulator explicitly skips the integration tests.

Manual iPhone: Safari > Share > Add to Home Screen > open installed app > Settings > Notifications > Enable. Approve permission, send a test, close the app, receive the lock-screen notification and tap it. Verify a new registration and availability change open the correct student and availability panel. Verify the unread count/read action. Minimum iOS/iPadOS 16.4; test on an actual device, not desktop emulation.

Android/desktop: enable notifications in a supported browser, install where offered, test foreground and closed-app delivery, notification click, deny permission, disable this device, multiple devices, logout, and account switching. On iPhone the normal Safari tab must show installation guidance instead of requesting unsupported permission. Background delivery remains subject to OS/browser settings and connectivity.

Offline: verify the fallback on a disconnected navigation. Only the neutral offline screen and icon are explicitly cached. Authenticated HTML, APIs and Firestore business data are never added to the worker cache. Existing Firebase write semantics are not redesigned by this feature.

Student portal, registration, availability, staff login, schedule, payments/packages, evaluations/PDFs and Google Calendar should receive regression smoke tests. Student portal push and quiet-hour controls remain future work.
