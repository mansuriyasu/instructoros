# InstructorOS Deployment Checklist

This copy is for `https://instructoros.ca`. Do not connect it to the old SparkOn GitHub repo, Firebase project, Hostinger app, or database.

## GitHub

Create a new empty GitHub repository, for example:

```bash
mansuriyasu/instructoros.ca
```

After the repository exists, connect and push this local project:

```bash
git remote add origin git@github.com:mansuriyasu/instructoros.ca.git
git push -u origin main
```

If you choose a different repo name, use that repo's SSH or HTTPS URL instead.

## Firebase

Create a new Firebase project, for example `instructoros-ca`. Do not reuse `studio-2266724095-8613d`.

In the new Firebase project:

1. Create a Web App.
2. Enable Authentication with Email/Password.
3. Create a Firestore database.
4. Enable Storage if document/image upload storage is needed.
5. Add authorized domains for:
   - `instructoros.ca`
   - `www.instructoros.ca` if you use the www host
6. Deploy or copy the Firestore rules from `firestore.rules`.

Copy the new Web App config into hosting environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://instructoros.ca
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCkEDRREUD1IgHI5vU5TvBXEagO5lNc7x4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=instructoros.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=instructoros
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=instructoros.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1069699534694
NEXT_PUBLIC_FIREBASE_APP_ID=1:1069699534694:web:6bd06ab03d3956c27b02a7
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

## Server Secrets

Create fresh values for this project. Do not reuse production secrets from the old app unless intentionally approved.

```bash
GEMINI_API_KEY=
SHORTCUT_SECRET=
GOOGLE_CALENDAR_SETUP_SECRET=
GOOGLE_CALENDAR_STATE_SECRET=
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=
```

For Google Calendar, configure the OAuth redirect URI as:

```text
https://instructoros.ca/api/google-calendar/callback
```

Then visit this setup URL after deployment, replacing the secret:

```text
https://instructoros.ca/api/google-calendar/auth?secret=YOUR_GOOGLE_CALENDAR_SETUP_SECRET
```

## Hostinger Or Node Hosting

Connect the new GitHub repo to a separate Hostinger app/site. Do not attach it to the old `app.sparkondrive.ca` deployment.

Use:

```bash
npm install
npm run build
npm run start
```

The app expects Node 20.x in production.

Set all environment variables in the hosting provider before the first production start.

## DNS

Point `instructoros.ca` to the new hosting target only after the new hosting app is created.

After DNS is set, issue/refresh SSL for:

```text
instructoros.ca
www.instructoros.ca
```

## Verification

Before launch:

```bash
npm run typecheck
npm run build
```

After launch:

1. Open `https://instructoros.ca`.
2. Create the owner account using `yasin_mansuri@live.com`.
3. Confirm Firestore writes go to the new Firebase project.
4. Open a test WhatsApp message from the app and confirm it launches WhatsApp with the correct text.
5. Connect Google Calendar using the new OAuth client.
6. Confirm `https://app.sparkondrive.ca` still loads unchanged.
