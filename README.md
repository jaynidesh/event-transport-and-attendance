# Event Transport & Attendance (Angular 19 + Firebase)

Responsive Angular standalone application using Firebase Authentication, Realtime Database and callable Cloud Functions.

## Requirements
- Node.js 22, npm, Firebase CLI (`npm i -g firebase-tools`)
- Firebase project with **Realtime Database** and **Email/Password Authentication** enabled
- Firebase Cloud Functions deployment requires a supported billing plan (typically Blaze)

## 1. Configure
1. `npm install`
2. In Firebase Console create a Web app, then replace placeholder values in `src/environments/environment.ts`. Use your **Realtime Database URL** (not the Firestore URL).
3. Replace `REPLACE_WITH_FIREBASE_PROJECT_ID` in `.firebaserc` and check the `eventId` in environment and the allowlist in `functions/index.js`.
4. `firebase login`
5. `cd functions && npm install && cd ..`
6. Deploy database rules and callable function: `firebase deploy --only database,functions`

## 2. Migrate the supplied export
The supplied export has a trailing comma in its transport array, so this project includes a **corrected valid JSON copy** at `sample-data/source-corrected.json`. Do not use the original directly with `JSON.parse`.

Run `npm run test:migration`, then:

```sh
node scripts/migrate.cjs sample-data/source-corrected.json eoy2026
```

This produces `migrated-event.json` for review without changing your database. To upload to Firebase using the Admin SDK:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
export FIREBASE_DATABASE_URL=https://YOUR_DB_REGION.firebasedatabase.app
node scripts/migrate.cjs sample-data/source-corrected.json eoy2026 --write
```

**Caution:** The upload updates the event's `attendees` and `settings` nodes and may replace existing attendance for IDs in the import. Back up your production data first. `staff` records are preserved.

Status conversion: `not_attending` => `registrationStatus: not_attending`; other sample statuses => `registrationStatus: attending`. **All check-ins start as `pending`** because source `present` may mean registration/intent rather than confirmed event-day check-in. Adjust this mapping if your source has a different meaning.

## 3. Create a staff account
1. Firebase Console > Authentication > Users > Add user (email/password).
2. Copy the newly created user's **Firebase Auth UID**.
3. Grant access using a local Admin SDK script (never ship a service account in the frontend):

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
export FIREBASE_DATABASE_URL=https://YOUR_DB_REGION.firebasedatabase.app
node scripts/grant-staff.cjs YOUR_AUTH_UID eoy2026
```

## 4. Run

```sh
npm start
```

Visit `http://localhost:4200/` for public lookup and `/staff/login` for the staff login.

## 5. Deploy Angular

```sh
npm run build
firebase deploy --only hosting
```

## Security and operations
- Public users never read Realtime Database directly; `lookupTransport` uses an Admin SDK callable function and returns only transport information.
- Attendance reads and writes require an authenticated, active staff UID. Database rules enforce attendance state values, server timestamps, and staff attribution. Non-attendance data is admin-only.
- Public lookup currently uses a **basic per-IP per-minute rate limit (15)**. It is not sufficient by itself against distributed attacks or Employee ID enumeration. Before production, enable Firebase App Check for Functions, configure abuse protection/monitoring, consider a second lookup secret (ticket number), and restrict event identifiers.
- `lookupRateLimits` nodes accumulate; schedule periodic cleanup or replace with a TTL-backed store for long-running events.
- An Employee ID is not a secret. Do not expose sensitive personal data in public responses. Anyone knowing a valid ID can retrieve the assigned transport details.
- The dashboard currently shows the first 150 matching attendees; counts use the full loaded event. For very large events, add indexed server-side pagination and aggregate counters.
- Check-in uses an RTDB transaction to avoid overwriting concurrent updates. Duplicate status submissions are ignored; status changes can be made by any authorized staff member.
- Database rules do not provide immutable attendance audit history. For stronger compliance, move attendance updates to an authenticated callable function that writes append-only audit records.
- Function region and Firebase database location may differ; choose a nearby region for production and update both Angular and Functions config together.
