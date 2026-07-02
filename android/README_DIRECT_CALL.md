Direct Call Integration (Android)

This folder contains example native code for performing a direct call (ACTION_CALL) on Android.
Follow the steps below to integrate this into a React Native / Expo app (bare workflow required).

1) Eject / Prebuild (Expo managed -> bare)

If using Expo Managed, run:

```bash
expo prebuild
# or
expo eject
```

This will create the `android/` and `ios/` directories if not present.

2) Copy Java files to your Android app source

Place these files under your Android package path, e.g.:

`android/app/src/main/java/com/smartsafezone/DirectCallModule.java`
`android/app/src/main/java/com/smartsafezone/DirectCallPackage.java`

Adjust the `package` declaration at the top of each file (`package com.smartsafezone;`) to match your app's Java package.

3) Add package registration

Open `android/app/src/main/java/.../MainApplication.java` and in the `getPackages()` method, add:

```java
import com.smartsafezone.DirectCallPackage; // add at top

// inside getPackages():
packages.add(new DirectCallPackage());
```

4) Add permission to `AndroidManifest.xml`

Add the following line to `android/app/src/main/AndroidManifest.xml` (outside `<application>`):

```xml
<uses-permission android:name="android.permission.CALL_PHONE" />
```

5) Rebuild the Android app

Open the `android` folder in Android Studio and build, or run from terminal:

```bash
cd android
./gradlew assembleDebug
# or to install on connected device/emulator
./gradlew installDebug
```

6) Runtime flow

From JS, call the native module (we added a JS wrapper at `app/native/DirectCall.ts`):

```js
import { callNumber } from '../native/DirectCall';
await callNumber('+8801XXXXXXXX');
```

The JS wrapper already requests `CALL_PHONE` permission via `PermissionsAndroid` and will fall back to opening the dialer if permission is denied or if the native module isn't available.

Notes & Caveats
- Direct calling requires explicit runtime permission (`CALL_PHONE`) and will be rejected by the Play Store if misused. Only use for legitimate emergency features.
- iOS does NOT allow direct silent calling; `tel`/`telprompt` will only open the dialer.
- After ejecting, you will need to maintain native code and handle app signing, Play Store requirements, and permission rationale dialogs as needed.

