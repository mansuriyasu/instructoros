# Google Calendar rescheduling reconciliation

Edit, drag/drop, bulk schedule adjustment and Optimize Timing now queue saved appointment IDs for the signed-in user's connected Google Calendar. Pending IDs are retained in this browser, scoped to user and tenant; no student details or OAuth tokens are stored in that queue.

While Schedule is open and visible, the worker sends up to 20 IDs in a request, with at least 15 seconds between automatic requests. Failures remain queued and retry after a minute. Reopening Schedule restores pending IDs, including appointments moved outside the displayed month. A second edit during an upload receives a new queue token and cannot be removed by the older response. The API rereads saved records, verifies active membership and assignment, and uses the caller's Google connection. It never uses queued times or browser-supplied Google event content.

Each successful appointment stores `googleSyncSignatures[uid]` alongside `googleEventIds[uid]`. The signature describes the fields acknowledged by Google. A later edit differs and remains eligible for reconciliation. Signature fields are internal metadata, not financial or student import/export fields. Existing linked appointments without signatures receive an initial reconciliation when viewed, which also repairs previously missed edits. Unchanged acknowledged appointments are not automatically requeued.

The schedule status distinguishes pending, uploading, confirmed, and failed/retrying updates. Keep Schedule open until pending changes clear. This is not a server background job: closing the app pauses browser retries. Reconnect an expired Google connection in Settings. Clearing browser storage removes queued IDs, but visible appointments with mismatched server acknowledgements will be rediscovered.

The old cross-calendar orphan cleanup has been removed from schedule sync and deletion. The displayed month's event list cannot establish that an event in another month or tenant is an orphan. Explicit deletion still targets the selected appointment's linked Google event; sync does not delete unrelated events.

Tests: `node --test scripts/calendar-reconciliation.test.cjs`. The mocked tests cover current stored timestamps, failed acknowledgements, concurrent edits, disconnected/reloaded queues, batched uploads, access boundaries, deleted records, DST, and excluded payment metadata. They do not contact Google or create production appointments/messages.
