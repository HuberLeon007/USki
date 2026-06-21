# USki Mobile (Expo / React Native)

Phone-optimized client for the USki flashcard app. Talks to the same FastAPI
backend as the web app.

## Run in development (wireless, no APK install needed)

1. Install **Expo Go** on your Android phone (Play Store).
2. Set the backend URL in `.env` to your PC's LAN IP (find via `ipconfig`):
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.192:8000
   ```
3. Start Metro:
   ```
   npm install        # first time
   npx expo start
   ```
4. Scan the QR code with Expo Go (phone + PC on the same WiFi). The app
   hot-reloads on every code change.

Backend must be reachable from the phone: it has to listen on `0.0.0.0:8000`
(Docker already does) and Windows Firewall must allow port 8000.

## Build a real APK (EAS cloud build)

No local Android SDK needed; EAS builds in the cloud.

```
npm i -g eas-cli
eas login
eas init                                   # links the project to your account
eas build -p android --profile preview     # -> downloadable .apk (internal)
```

Profiles in `eas.json`:
- `development` – dev client APK (custom native code)
- `preview` – installable **APK** for testing
- `production` – Play Store **AAB**

## Features

Auth (email OTP), Overview (review stats), Decks + folders, Browse (search),
Shared (incoming/outgoing, redeem invite, leave), deck detail + card CRUD,
study/review loop (SRS grades), Sero AI chat (streaming), notifications,
settings (username, email-2FA, logout).

## Notes

- Cards render as plain text on native (HTML is reduced for previews/study).
- The web target (`npx expo start --web`) currently fails to resolve
  `@expo/vector-icons` glyph assets under Metro web; Android/Expo Go are
  unaffected. Use Expo Go for testing.
