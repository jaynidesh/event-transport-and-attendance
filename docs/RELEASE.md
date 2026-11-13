# Release and Firebase deployment guide

Run commands from the repository root. See [BUILD.md](BUILD.md) for prerequisites, builds and Android signing.

## Release destination

| Component | Configuration |
| --- | --- |
| Firebase project | `sbmeoy-76e19` |
| Event | `eoy2026` |
| Realtime Database | `sbmeoy-76e19-default-rtdb`, region `asia-southeast1` |
| Callable Functions | `lookupTransport`, `importAttendees`, region `us-central1` |
| Functions source/runtime | `functions/`, Node.js 22 |
| Hosting source | `dist/event-transport-app/browser/` |
| Database rules | `database.rules.json` |
| Android application ID | `com.sbmeoy.eventtransport` |

These values reflect repository configuration, not confirmation of the live deployment.

## Before release

1. Record the release version, source revision or archived source snapshot, operator and date.
2. Confirm Firebase access, billing required by Functions, Email/Password Authentication, and the intended database instance.
3. Review frontend Firebase configuration and backend event allowlist. Existing Firebase accounts and event staff/admin records are not created by deployment.
4. Retain the prior deployable source/artifacts and database rules. Back up event data before an import or migration that changes it.
5. Install and verify:

```sh
npm ci
npm --prefix functions ci
npm test
node --check functions/index.js
node --check functions/import-handler.js
node --check functions/import-data.js
npm run build
```

If Firebase CLI is not installed, install it once, then authenticate and confirm access:

```sh
npm install -g firebase-tools
firebase login
firebase projects:list
```

Commands below pin the project explicitly to avoid deploying to a different active alias.

## Deploy the full application

Deploy backend functions and database rules first, then the frontend that calls them:

```sh
firebase deploy --only functions,database --project sbmeoy-76e19
firebase deploy --only hosting --project sbmeoy-76e19
```

The Functions step deploys both `lookupTransport` and `importAttendees`. Wait for each command to succeed before continuing. A Firebase deploy can partially succeed; inspect the CLI output rather than assuming all resources changed together.

For a coordinated deployment after completing the same build/checks, the equivalent combined selection is:

```sh
firebase deploy --only hosting,functions,database --project sbmeoy-76e19
```

Deployment uploads code, Hosting assets and database **rules**. It does not upload `migrated-event.json`, import CSVs, reset attendance or grant admin access. The CLI's selective deployment behavior is documented in the [Firebase CLI reference](https://firebase.google.com/docs/cli).

## Deploy only changed components

### Web frontend

```sh
npm run build
firebase deploy --only hosting --project sbmeoy-76e19
```

### Both callable Functions

```sh
npm --prefix functions ci
npm test
firebase deploy --only functions:lookupTransport,functions:importAttendees --project sbmeoy-76e19
```

### CSV import Function only

```sh
firebase deploy --only functions:importAttendees --project sbmeoy-76e19
```

Deploy this function when changing validation, overwrite/skip behavior or import authorization. Frontend changes also require rebuilding and deploying Hosting, and rebuilding the APK for Android users. See [Firebase Functions deployment guidance](https://firebase.google.com/docs/functions/manage-functions?gen=2nd).

### Realtime Database rules only

```sh
firebase deploy --only database --project sbmeoy-76e19
```

Review `database.rules.json` before deploying; this publishes the repository rules over the configured database rules. It does not migrate records.

## First-time staff/admin access

Create the user through Firebase Authentication, then copy its UID. With an authorized Admin SDK service-account file stored outside the repository:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
export FIREBASE_DATABASE_URL=https://sbmeoy-76e19-default-rtdb.asia-southeast1.firebasedatabase.app
npm run grant-admin -- YOUR_AUTH_UID eoy2026
```

For attendance-only staff, use `npm run grant-staff -- YOUR_AUTH_UID eoy2026` instead. Do not run the staff grant over an admin account unless intentionally changing its role.

Admins need `{active: true, role: "admin"}` at `events/eoy2026/staff/{uid}`. Ordinary active staff may manage attendance but cannot import CSVs. Provisioning credentials are not needed to run the browser app and must not be shipped with it.

## Post-deployment checks

Use the Hosting URL printed by the CLI. Verify these flows with designated test records:

- Public transport lookup returns the assigned pickup/drop-off details.
- `/staff/login` accepts an authorized staff account; dashboard data loads and check-in changes appear on a second session.
- An admin sees **Import employees** and can open `/staff/import`; an ordinary staff account cannot import.
- Download the CSV template, upload a test file, and inspect create/update/skip counts before importing.
- Duplicate IDs, ticket conflicts and invalid required values block import.
- Checked overwrite updates supplied values and preserves blanks and attendance; unchecked overwrite skips existing employees.
- Refresh `/staff/dashboard` and `/staff/import` directly to verify Hosting route rewrites.
- On the Android test device, verify login, lookup, attendance and CSV file selection/template download separately. Successful APK compilation does not confirm these flows.

Check deployed functions and logs if a callable request fails:

```sh
firebase functions:list --project sbmeoy-76e19
firebase functions:log --only lookupTransport,importAttendees --project sbmeoy-76e19
```

Record test results and any outstanding issues in the release record. Test imports modify data only when the import action is confirmed; preview is read-only.

## Android distribution

Build and verify the intended debug or signed release artifact using [BUILD.md](BUILD.md). The current npm APK script is for debug builds, not release signing. Record versionCode, versionName, APK checksum and signing identity. Test an upgrade from the previous distributed version before handing it to users.

```sh
shasum -a 256 /path/to/distributed.apk
```

Publishing Hosting or Functions does not distribute a new APK. Keep backend changes compatible with installed app versions.

## Rollback

- **Hosting:** select the prior release's rollback action in Firebase Console > Hosting. This affects only Hosting. See the [Firebase CLI reference](https://firebase.google.com/docs/cli).
- **Functions:** restore the previous known-good `functions/` source and lockfile, install its dependencies, then redeploy the affected named functions. Hosting rollback does not roll back Functions.
- **Rules:** restore the reviewed previous `database.rules.json` and deploy `--only database`.
- **Android:** deliver a corrected build signed with the same release key and a higher versionCode; do not assume Android will accept a downgrade.
- **Imported data:** code rollback does not undo CSV writes. Restore data only through a reviewed recovery process that accounts for check-ins recorded after the backup. Do not run the legacy migration to undo an import: it can replace attendance.

## Release record template

```text
Release/version:
Date and operator:
Source revision or archive:
Firebase project / event:
Deployed functions:
Hosting release:
Database rules changed:
Build and test results:
Web smoke-test results:
Android versionCode / versionName:
APK path / SHA-256 / signing identity:
Device smoke-test results:
Data imports performed (if any):
Known limitations:
Previous release / rollback artifacts:
```
