# Event Transport & Attendance (Angular 19 + Firebase)

Responsive Angular standalone application using Firebase Authentication, Realtime Database and callable Cloud Functions.

## Build and release guides

- [Build guide](docs/BUILD.md): dependencies, verification, web builds, debug APKs and signed Android releases.
- [Release guide](docs/RELEASE.md): Firebase Hosting, both callable Functions, database rules, access setup, smoke checks and rollback.

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

## Admin CSV backoffice

Open `/staff/import`, or sign in and choose **Import employees** on the dashboard.
Only an active event staff record with `role: "admin"` can preview or import files.
The callable function enforces this independently of the Angular route guard;
ordinary staff retain attendance access but cannot import employee records.

Grant an existing Firebase Authentication user admin access using local Admin SDK credentials:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
export FIREBASE_DATABASE_URL=https://YOUR_DB_REGION.firebasedatabase.app
npm run grant-admin -- YOUR_AUTH_UID eoy2026
```

Deploy the new callable endpoint and rebuild/deploy the frontend before using the page:

```sh
firebase deploy --only functions:importAttendees
npm run build
firebase deploy --only hosting
```

Workflow:
1. Download `event-attendees-template.csv` from the backoffice. The example row must be replaced.
2. In Excel, format ID, ticket and phone columns as **Text** before entering values. Save as **CSV UTF-8 (comma delimited)**, not XLSX. Excel can otherwise remove leading zeros.
3. Upload the CSV. Validation and preview run on the authenticated server without writing data.
4. Review create/update counts, registration, attendance and expandable transport details. Fix any errors and upload again.
5. Choose **Import employees into Firebase** to commit the whole file atomically.

`employeeId` and `registrationStatus` are required. Employee IDs normalize to uppercase and must contain 2–40 letters, digits, underscores or hyphens. Registration is `attending` or `not_attending`. Optional tickets use 1–40 letters, digits, underscores or hyphens. Pickup times use `HH:mm` or `HH:mm:ss`. Unknown/duplicate headers, invalid rows, duplicate normalized IDs, duplicate tickets and ticket collisions with other database employees block import. Files are limited to 500 employees / 1 MB.

The existing root `event-attendees-existing.csv` can be uploaded through this same admin workflow. It is intentionally not published as a public download because it contains employee assignments. Both supplied CSV files are covered by the parser tests. The backend writes the format from `sbmeoy-76e19-default-rtdb-export_new.json` under `events/eoy2026/attendees/{employeeId}`.

**Overwrite existing employees** is checked by default. Uncheck it to create only new employees and skip matching Employee IDs completely. Changing this option refreshes the preview; create/update/skip counts reflect the selected mode. The server rechecks which employees exist at commit time.

Blank optional fields preserve existing values. Nonblank fields replace the corresponding values; omitted employees are not removed. Existing attendance status, timestamp and staff attribution are preserved. New employees receive `attendance: {status: "pending"}`. Settings and staff records are preserved. The import revalidates tickets and administrator access in a transaction against the latest event state, including check-ins made since preview. No direct client write permission to employee records is added.

Run `npm test` for migration, CSV and import-handler tests. Handler tests use an in-memory database adapter; deployed Firebase and browser verification remain separate integration checks.

## Android APK

The Capacitor Android project uses app ID `com.sbmeoy.eventtransport` and bundles the Angular production build locally. Firebase features still require an internet connection and deployed backend functions.

With JDK 17 and Android SDK 34 installed:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run android:apk
```

The installable debug-signed APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. It is for direct installation/testing; a store release requires your release signing configuration. No release signing credentials are included.

## Attendance CSV export

Staff can select **Export CSV** on the dashboard to download all eligible (`attending`) employees, regardless of the current search or 150-row display limit. Columns include Employee ID, ticket, registration, attendance status and last update in UTC. The UTF-8 CSV includes an Excel-compatible BOM, quoted fields and formula protection. This attendance report has different columns from the import template and should not be uploaded as an import file.

## Employee ID shorthand

Public transport lookup accepts `001` for `EMP001`. Exact IDs take precedence: if `001` exists, that record is used. Otherwise numeric input tries the same digits prefixed with `EMP`, preserving leading zeros. Full alphanumeric IDs remain exact matches. Deploy `lookupTransport` for this behavior; the dashboard already supports partial ID searches.
