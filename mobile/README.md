# SD Mivtzoim: the Android app

A small Expo app that shows the site from a file kept inside the app (`assets/site/app.html`),
so it never loads sdmivtzoim.com. It talks only to the database. When the site is updated, the
deploy publishes a new `app.html`, and the app downloads it by itself.

## Build the APK

```bash
cd mobile
npm install
npx eas-cli login          # the tzvikogan Expo account
npx eas-cli init           # links this folder to the "sd-mivtzoim" project (first time only)
npm run build:apk          # builds in Expo's cloud; download the .apk from the link it prints
```

## Refresh the copy of the site packed into the app

Only needed before building a new APK (the app updates itself otherwise):

```bash
cd mobile
npm run site
```

## A new APK is only needed when

- the app's name, icon or permissions change, or
- something in `App.js` changes.
