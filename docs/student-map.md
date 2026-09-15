# Student Map

Open **Quick actions → Student Map** or the Map button on Students.

- Shows active and booked students, excluding merged records. Upcoming appointments and date filters exclude cancelled/no-show lessons. Dates use the browser's local timezone.
- School instructors see only students assigned through assignedInstructorIds or legacy instructorId; admins and solo instructors see their workspace. The API checks active tenant membership before querying records and returns only map fields.
- Pins show names; nearby pins cluster. Select a cluster to see every student, including identical addresses. The list remains usable when Google is unavailable.
- Uses the saved address, falling back to structured pickup address. Unmatched, partial, or city-level results require address review; no approximate city pin is silently shown.

## Google setup

Use the existing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Enable Maps JavaScript API, Geocoding API and the existing Places API. Restrict the key to those APIs and production website referrers (plus localhost only where needed). Configure billing, quotas and budget alerts in Google Cloud. Alerts do not cap spending.

Optional NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID configures a production JavaScript map ID. Google supports DEMO_MAP_ID for development; supply your own for production styling. Public variables must be present at build time; rebuild on Hostinger after changing them.

## Storage and costs

This initial implementation does not add coordinates to Firebase or change import/export. Successful lookups are cached in browser memory for one hour, scoped to user and tenant, and keyed by address. Refreshing the page starts a new cache; two browsers do not share results. Changing an address naturally invalidates its lookup. Filters/marker clicks do not create a new map. Addresses are resolved serially and global API errors stop the queue.

This intentionally differs from the original permanent-cache proposal. Google restricts location caching; persistent shared caching needs an expiration/deletion mechanism before it can be introduced. Geocoding calls can recur after reload/cache expiry, so monitor Geocoding as well as Dynamic Maps usage. See https://cloud.google.com/maps-platform/terms/maps-service-terms, section 6.3.

## Verification

Run npm run typecheck, npm run lint, npm run build, and node --test scripts/student-map.test.cjs.
Verify desktop and mobile with a staff session: tenant/instructor permissions, active/booked filters, date selection, names, identical locations, profile links, Waze, missing addresses, denied key and quota errors. No production test students or messages are required.
