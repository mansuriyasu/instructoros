# Offline workspace

Open Home → Offline (or the Offline access banner) while connected. Choose **Enable on this trusted phone** and wait for the download confirmation. **Open saved workspace** works without Firebase, a sign-in refresh, or a live network request once the shell is installed.

## Included in this release

- Active/booked students: names, addresses, mobile numbers, licence type and status. No licence images, identity numbers, payment history, account tokens or student portal credentials are downloaded.
- Today and the upcoming seven days of lessons, with saved notes. The server fetch includes a previous-UTC-day margin to cover Canadian local dates.
- New student drafts, lesson note edits, and practice evaluations using the existing maneuver criteria. The full road-test replica sheet remains online.
- IndexedDB storage survives ordinary reloads and closing/reopening the app. Browser storage clearing, eviction, uninstalling the web app or private-browsing limitations can remove unsynced data. The app asks for persistent storage where supported but cannot guarantee iOS will retain it.
- A last-downloaded timestamp, pending count, upload status, and explicit server-confirmed Synced receipts.

This release intentionally leaves scheduling edits, money movement/payment records, customer messages, OTP, and Google Calendar/Maps online-only. Normal Firebase write helpers reject known-offline writes and point staff to the saved workspace instead of silently buffering unsupported operations.

## Online refresh and sync

The signed-in app checks on opening, returning to the foreground, reconnecting, and every 15 seconds while visible. Automatic downloads refresh at most once every 24 hours while the app is visible. Use Download latest & sync before leaving coverage for a fresh copy. Successful draft uploads and conflict review also refresh the copy; uploads retry on the next check. Rate-limit responses back off for 15 minutes. Network errors back off for 30 seconds.

The standalone saved workspace does not store auth tokens. Use **Reconnect & sync** to return to the signed-in app; keep it open until entries say Synced. iPhone background execution is not required. Downloads older than seven days remain readable with a stale warning but cannot accept new drafts until refreshed.

## Permission and conflict boundaries

Offline snapshots use verified Firebase staff identity and active membership. The tenant ID is a selector only: membership is checked server-side before querying data. Instructors receive only assigned students (including legacy assignments). Instructors may edit notes only for their own lessons; evaluations also require the existing assigned-student evaluation permission. Administrators and solo instructors keep their existing scope.

Every upload checks active membership and writable billing status again inside a Firestore transaction. Student/lesson relationships, assignments, merged/deactivated students, cancelled/no-show lessons, and the lesson's Firestore update-time revision are rechecked. Conflicting edits remain local. Review & resubmit uses a newly downloaded revision and a new operation ID; it never forces an overwrite.

Student drafts are checked against normalized phone numbers and exact case-insensitive names across the tenant before creating a record. A possible duplicate blocks the draft; it does not reveal another instructor's student details or automatically merge students.

Each immutable draft has a UUID. The server creates the record and a receipt under `tenants/{tenantId}/offlineOperations/{uid}_{uuid}` atomically. Replays with identical contents return the existing receipt; different contents using the same UUID are rejected. Draft upload leases also prevent simultaneous tabs from normally sending the same item. Receipt documents are internal server metadata, not user-editable records. Existing Firestore deny-by-default rules apply to ordinary staff. Keep receipts when restoring backups if old devices may replay drafts; ordinary student/event/evaluation fields and exports are unchanged.

## Device handling

Only one workspace is enabled per device. Switching workspace hides the saved workspace until the original workspace is selected or a new one is explicitly enabled. Pending drafts must be synced or removed before enabling another workspace. Logout warns about pending drafts, then clears the local snapshot, queue and receipts. Auth identity changes clear the previous user's offline data. Known access revocation suspends the snapshot; offline permission changes cannot be discovered until reconnection.

Only the static offline HTML/CSS/JS/icons are service-worker cached. API responses and authenticated application HTML are not added to the HTTP cache. On failed or timed-out full navigation to `/app`, the service worker serves the static offline workspace. Existing open app pages expose a direct saved-workspace link. The offline HTML alone permits same-origin framing for the app's offline management page; other pages retain frame protection.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run security:check`
- `node --test scripts/offline-sync.test.cjs scripts/student-map.test.cjs`
- `node scripts/offline-browser-fixture.cjs` serves local sample data on port 9003; `/__fixture` exercises native IndexedDB and a service-worker network-failure fallback without contacting production or Firebase. Never deploy this fixture server.

On a physical iPhone: enable offline access, wait for download, turn on airplane mode, open the saved workspace, save each supported draft type, close/reopen, then reconnect and return to Offline access. Verify each item becomes Synced or explicitly Needs review. Check another staff account and workspace to confirm cached data is hidden/cleared appropriately.
