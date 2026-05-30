# My Age In — Android app

A [Capacitor](https://capacitorjs.com/) wrapper around the Milestone Age
Calculator. It bundles the web app so it runs **fully offline** and adds
**local milestone notifications** so the phone alerts the user as they approach
a fun milestone — with no backend.

## What's here

```
android-app/
├── www/                     # the bundled web app (served inside the WebView)
│   ├── index.html           # copy of the site, libraries pointed at local files
│   └── js/
│       ├── luxon.min.js      # bundled (was a CDN script on the website)
│       ├── lucide.min.js     # bundled (was a CDN script on the website)
│       └── notifications.js  # milestone notification scheduler (native only)
├── android/                 # native Android project (open this in Android Studio)
├── capacitor.config.json
└── package.json
```

The root `index.html` of the repo (the live website) is **untouched** — this
app lives entirely in `android-app/`.

## How the milestone notifications work

`www/js/notifications.js` hooks into the existing `applyDOB()` flow. Once a
birth date is entered it:

1. Requests the `POST_NOTIFICATIONS` permission (Android 13+).
2. Takes the **nearest 16 upcoming milestones** and schedules, for each, a
   "tomorrow" reminder and an "on the day" alert via
   `@capacitor/local-notifications`.
3. Re-builds this rolling window every time the app is resumed, so the schedule
   keeps advancing and never relies on the OS holding years of far-future alarms.

Alarms use `allowWhileIdle` so they fire in Doze mode. We intentionally do **not**
request `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` — milestone reminders don't
need alarm-clock precision, and those permissions trigger extra Google Play
policy review. Notifications may therefore fire within a maintenance window of
the target time, which is fine for this use case.

On the plain website (no Capacitor runtime) `notifications.js` is a no-op.

## Build & run

**Prerequisites:** [Android Studio](https://developer.android.com/studio)
(includes the Android SDK + Gradle) and JDK 21.

```bash
cd android-app
npm install            # restores node_modules (Capacitor + plugins + libs)
npx cap sync android   # copies www/ into the native project & updates plugins
npx cap open android   # opens the project in Android Studio
```

In Android Studio, pick a device/emulator and press **Run**. To build an
installable artifact: **Build → Generate Signed Bundle / APK**.

> This repo cannot be built in a headless CI sandbox without the Android SDK —
> the SDK install + signing happen on your machine / Android Studio.

## Updating the app after website changes

The app bundles a copy of the site. After editing the root `index.html`, refresh
the copy and re-point the two library scripts at the local bundles:

```bash
cp ../index.html www/index.html
sed -i 's#https://unpkg.com/lucide@latest/dist/umd/lucide.min.js#js/lucide.min.js#' www/index.html
sed -i 's#https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js#js/luxon.min.js#' www/index.html
# re-add the notifications script + window.S + schedule() hook if they were lost
npx cap sync android
```

(A small sync script could automate this later.)

## Publishing

Requires a **Google Play Developer account** ($25 one-time). Generate a signed
`.aab`, create the Play Console listing (icon, screenshots, description), and
upload. App id: `com.myagein.app`.

## Still TODO before shipping

- App icon + splash screen (currently Capacitor defaults). Use
  `@capacitor/assets` to generate them from a source logo.
- Bundle the Google Fonts locally for a fully offline look (currently the font
  `<link>` still points at Google Fonts and degrades to system fonts offline).
- Optional: a `@capacitor/background-runner` / WorkManager task to refresh the
  notification window even if the user rarely opens the app.
