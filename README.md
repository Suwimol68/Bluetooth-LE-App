# Bluetooth LE App

A classroom Bluetooth Low Energy app built with Expo SDK 57. Its Neo Brutalism design follows the supplied visual reference. The bottom tabs are **Devices** and **Lab**.

## Assignment flow

1. On **Devices**, scan for nearby BLE devices and connect. A successful connection opens **Lab** automatically.
2. In **Lab**, tap **Read value** to read the characteristic for the first time.
3. Enter your name and your buddy's name, then tap **Write value**. The app sends one UTF-8 value in the format “Your name, buddy name” and shows a success alert when the device accepts it.
4. Tap **Read the prediction** to read the same characteristic again. The displayed result comes from the device; the app does not generate a grade.
5. Capture screenshots of the results and submit them to Google Classroom. Tap **Disconnect** when finished.

The app follows the supplied slides: scan, connect, discover services, then show Read, Write, and Disconnect controls. It scans all nearby BLE devices because some devices do not advertise their service UUID. The sample device may appear as “Mobile App 169”, but the name alone does not confirm its GATT configuration. Read and Write always target the assignment's fixed UUIDs. If a connected device does not expose them, the operation reports an error; the app cannot obtain the classroom value from another service. The UUIDs also appear at the bottom of the app.

## UUIDs

- Service: aee04821-1973-4e1f-a590-e84b10d580e7
- Characteristic: cde07b1a-889b-44b7-a99f-c888dddac729

## Run on a phone

This project uses react-native-ble-plx, which requires native code. Install an Android or iOS build of this app on a physical phone; Expo Go cannot run its BLE features.

    npm install
    npm run android

The Android command requires the Android SDK and a connected phone with USB debugging enabled. On macOS, use Xcode and npm run ios for an iPhone build. After a development build is installed, npm start can start Metro for later code changes.

Android 12 and newer request Bluetooth Scan and Connect permissions. Older Android versions request Location permission for BLE scanning. The app does not use scan results to determine location.

The app warns when the name payload is longer than 20 bytes because some peripherals may reject longer writes. Actual BLE behavior and the predicted grade can only be verified when the classroom device is available.
