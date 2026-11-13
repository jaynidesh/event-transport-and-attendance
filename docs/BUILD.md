# Build guide

Applies to Event Transport & Attendance. Run commands from the repository root unless stated otherwise. Deployment is covered in [RELEASE.md](RELEASE.md).

## Toolchain

- Node.js 22 and npm: the Functions runtime is Node.js 22; the Angular package accepts Node.js >=20.11.
- Angular 19 and Capacitor 6 are installed from the project lockfile.
- Android builds: JDK 17, Android SDK platform 34, build-tools 34.0.0, and accepted SDK licenses. Use the checked-in Gradle wrapper.
- Firebase CLI is needed for deployment, not for the web build.

Install dependencies for both packages:

```sh
npm ci
npm --prefix functions ci
```

## Configuration

Check these files before building for another environment:

| File | Purpose / current value |
| --- | --- |
| `src/environments/environment.ts` | Firebase web configuration, event `eoy2026`, Functions region `us-central1` |
| `.firebaserc` | Default Firebase project `sbmeoy-76e19` |
| `firebase.json` | Hosting output, database rules, Functions directory and Node.js 22 runtime |
| `functions/index.js` | Allowed event IDs and callable Functions region |
| `capacitor.config.ts` | App ID `com.sbmeoy.eventtransport`, name `Event Transport`, web output directory |
| `android/app/build.gradle` | Android versionCode, versionName and signing/build configuration |

Changing the CLI project does not change the Firebase project embedded in the Angular app. Keep client configuration, Functions event allowlist and deployment destination consistent. Never put service-account keys in frontend assets.

## Checks and production web build

```sh
npm test
node --check functions/index.js
node --check functions/import-handler.js
node --check functions/import-data.js
npm run build
```

The production web artifact is `dist/event-transport-app/browser/`. It includes the downloadable CSV template. Firebase Hosting is configured to serve this directory and rewrite Angular routes to `index.html`.

`npm test` covers migration, CSV parsing and import-handler behavior. The handler tests use an in-memory database adapter; they do not establish deployed Firebase or Android behavior.

Functions are CommonJS JavaScript in `functions/`; there is no separate Functions compilation script. Installing its dependencies and running the checks above prepares the source for deployment.

For local Angular development:

```sh
npm start
```

Open `http://localhost:4200`. This uses the Firebase backend in `environment.ts`; no emulator configuration is currently provided.

## Android debug APK

On macOS, select the installed JDK and SDK:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run android:apk
```

For other operating systems, set these variables to their local JDK 17 and Android SDK paths.

The script builds Angular, syncs web assets to Capacitor, and runs `assembleDebug`. Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Verify the signature and install on a connected test device with USB debugging enabled:

```sh
"$ANDROID_HOME/build-tools/34.0.0/apksigner" verify --verbose android/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/platform-tools/adb" install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The APK is debug-signed. Firebase features need connectivity and the deployed backend. Hosting deployment does not update web assets already bundled inside an installed APK; rebuild and redistribute the APK after frontend changes.

## Signed Android release

The repository does **not** currently configure release signing. `npm run android:apk` always produces a debug APK.

1. Increment `versionCode` and set `versionName` in `android/app/build.gradle` for the new Android release.
2. Run `npm run android:sync` to include the latest production web assets.
3. Run `npx cap open android`.
4. In Android Studio, choose **Build > Generate Signed Bundle / APK** and choose APK for direct distribution, or Android App Bundle for a Play release.
5. Select the approved release keystore and the release variant; use the existing signing identity for upgrades. Store passwords and keystores outside the repository.
6. Record the generated artifact location shown by Android Studio. For an APK, verify it with `apksigner verify --verbose /path/to/release.apk` and test installation/update before distribution.

See the official [Android signing instructions](https://developer.android.com/studio/publish/app-signing.html). This guide does not establish current Play Store eligibility for the project's target SDK.

## Troubleshooting

- Wrong Java version: check `java -version` and `JAVA_HOME`; use JDK 17 for this Android project.
- Missing SDK: set `ANDROID_HOME`, or configure `sdk.dir` in the ignored `android/local.properties`.
- Stale APK content: run `npm run android:sync` before invoking Gradle directly.
- Missing dependencies: use the root and Functions `npm ci` commands above.
- Angular exits with code 134 inside a restricted execution sandbox: retry the same build in a normal terminal. Earlier sandboxed builds aborted while normal-terminal builds succeeded.
- Existing Angular optional-chain warnings in the dashboard are warnings, not a successful runtime test. Treat any nonzero build exit as a failed build.
