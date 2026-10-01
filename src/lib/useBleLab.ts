import { Buffer } from 'buffer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Device, State, type Subscription } from 'react-native-ble-plx';

export const SERVICE_UUID = 'aee04821-1973-4e1f-a590-e84b10d580e7';
export const CHAR_UUID = 'cde07b1a-889b-44b7-a99f-c888dddac729';

type Activity = 'connecting' | 'readingFirst' | 'writing' | 'readingFinal' | 'disconnecting' | null;

const DISCOVERY_TIMEOUT_MS = 15000;

async function withDiscoveryTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Service discovery timed out. Reconnect to the device and try again.')), DISCOVERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function describeError(error: unknown, message: string) {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  return detail ? `${message} (${detail})` : message;
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;

  if (Number(Platform.Version) >= 31) {
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ===
    PermissionsAndroid.RESULTS.GRANTED;
}

export function useBleLab() {
  const managerRef = useRef<BleManager | null>(null);
  const disconnectSubscriptionRef = useRef<Subscription | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef<Device | null>(null);
  const writeWithResponseRef = useRef(true);
  const operationRef = useRef(false);

  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [activity, setActivity] = useState<Activity>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [firstValue, setFirstValue] = useState<string | null>(null);
  const [writtenValue, setWrittenValue] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopScan = useCallback(() => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    managerRef.current?.stopDeviceScan();
    setIsScanning(false);
  }, []);

  const resetJourney = useCallback(() => {
    connectedRef.current = null;
    setConnectedDevice(null);
    setFirstValue(null);
    setWrittenValue(null);
    setPrediction(null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setError('Bluetooth LE requires an Android or iOS app build.');
      return;
    }

    let manager: BleManager;
    try {
      manager = new BleManager();
    } catch {
      setError('Bluetooth LE is unavailable. Install a development build of this app; Expo Go cannot connect to BLE devices.');
      return;
    }
    managerRef.current = manager;
    const stateSubscription = manager.onStateChange((state) => {
      setBluetoothState(state);
      if (state !== State.PoweredOn) stopScan();
    }, true);

    return () => {
      stopScan();
      disconnectSubscriptionRef.current?.remove();
      stateSubscription.remove();
      manager.destroy();
      managerRef.current = null;
    };
  }, [stopScan]);

  const scan = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) {
      setError('Bluetooth LE is unavailable in this app build.');
      return;
    }
    if (operationRef.current) return;
    setError(null);
    stopScan();

    try {
      const granted = await requestBluetoothPermissions();
      if (!granted) {
        setError('Allow Bluetooth access for this app, then scan again.');
        return;
      }
      const state = await manager.state();
      if (state !== State.PoweredOn) {
        setError('Turn on Bluetooth on your phone before scanning.');
        return;
      }

      setDevices([]);
      setHasScanned(true);
      setIsScanning(true);
      // Some peripherals do not advertise their service UUID, so scan all nearby BLE devices.
      manager.startDeviceScan(null, { allowDuplicates: false }, (scanError, device) => {
        if (scanError) {
          stopScan();
          setError(describeError(scanError, 'Could not scan for devices'));
          return;
        }
        if (!device) return;
        setDevices((current) => {
          if (current.some((item) => item.id === device.id)) return current;
          return [...current, device]
            .sort((a, b) => {
              const aService = a.serviceUUIDs?.some((uuid) => uuid.toLowerCase() === SERVICE_UUID) ? 1 : 0;
              const bService = b.serviceUUIDs?.some((uuid) => uuid.toLowerCase() === SERVICE_UUID) ? 1 : 0;
              const aTarget = /mobile app/i.test(a.name ?? a.localName ?? '') ? 1 : 0;
              const bTarget = /mobile app/i.test(b.name ?? b.localName ?? '') ? 1 : 0;
              return bService - aService || bTarget - aTarget || (b.rssi ?? -120) - (a.rssi ?? -120);
            })
            .slice(0, 40);
        });
      });
      scanTimerRef.current = setTimeout(stopScan, 12000);
    } catch (scanError) {
      stopScan();
      setError(describeError(scanError, 'Could not start scanning'));
    }
  }, [stopScan]);

  const connect = useCallback(async (device: Device) => {
    const manager = managerRef.current;
    if (!manager) {
      setError('Bluetooth LE is unavailable in this app build.');
      return false;
    }
    if (operationRef.current) return false;
    if (device.isConnectable === false) {
      setError('This device is not connectable. Select another device.');
      return false;
    }
    operationRef.current = true;
    stopScan();
    setActivity('connecting');
    setConnectingId(device.id);
    setError(null);
    let pendingConnection: Device | null = null;

    try {
      pendingConnection = await manager.connectToDevice(device.id);
      // The slide discovers GATT services before showing the read/write controls.
      const discovered = await withDiscoveryTimeout(pendingConnection.discoverAllServicesAndCharacteristics());
      disconnectSubscriptionRef.current?.remove();
      disconnectSubscriptionRef.current = manager.onDeviceDisconnected(discovered.id, (disconnectError) => {
        disconnectSubscriptionRef.current?.remove();
        disconnectSubscriptionRef.current = null;
        resetJourney();
        setError(disconnectError ? describeError(disconnectError, 'Device disconnected') : 'Device disconnected.');
      });
      connectedRef.current = discovered;
      setConnectedDevice(discovered);
      writeWithResponseRef.current = true;
      setFirstValue(null);
      setWrittenValue(null);
      setPrediction(null);
      return true;
    } catch (connectionError) {
      if (pendingConnection) {
        try { await manager.cancelDeviceConnection(pendingConnection.id); } catch { /* Already disconnected. */ }
      }
      setError(describeError(connectionError, 'Could not connect to the device'));
      return false;
    } finally {
      operationRef.current = false;
      setActivity(null);
      setConnectingId(null);
    }
  }, [resetJourney, stopScan]);

  const readFirst = useCallback(async () => {
    const manager = managerRef.current;
    const device = connectedRef.current;
    if (!manager || !device || operationRef.current) return;
    operationRef.current = true;
    setActivity('readingFirst');
    setError(null);
    try {
      const characteristic = await manager.readCharacteristicForDevice(device.id, SERVICE_UUID, CHAR_UUID);
      if (connectedRef.current?.id !== device.id) return;
      setFirstValue(Buffer.from(characteristic.value ?? '', 'base64').toString('utf8'));
      setWrittenValue(null);
      setPrediction(null);
      if (characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse) {
        writeWithResponseRef.current = characteristic.isWritableWithResponse;
      }
    } catch (readError) {
      setError(describeError(readError, 'Could not read the classroom characteristic. Check the device and UUIDs'));
    } finally {
      operationRef.current = false;
      setActivity(null);
    }
  }, []);

  const writeNames = useCallback(async (name: string, buddy: string) => {
    const manager = managerRef.current;
    const device = connectedRef.current;
    if (!manager || !device || operationRef.current) return false;
    if (!name.trim() || !buddy.trim()) {
      setError('Enter your name and your buddy\'s name before writing.');
      return false;
    }
    const payload = `${name.trim()}, ${buddy.trim()}`;
    operationRef.current = true;
    setActivity('writing');
    setError(null);
    try {
      const encoded = Buffer.from(payload, 'utf8').toString('base64');
      if (writeWithResponseRef.current) {
        await manager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, CHAR_UUID, encoded);
      } else {
        await manager.writeCharacteristicWithoutResponseForDevice(device.id, SERVICE_UUID, CHAR_UUID, encoded);
      }
      if (connectedRef.current?.id !== device.id) return false;
      setWrittenValue(payload);
      setPrediction(null);
      return true;
    } catch (writeError) {
      setError(describeError(writeError, 'Could not write the names. Try shorter names and write again'));
      return false;
    } finally {
      operationRef.current = false;
      setActivity(null);
    }
  }, []);

  const readFinal = useCallback(async () => {
    const manager = managerRef.current;
    const device = connectedRef.current;
    if (!manager || !device || operationRef.current || writtenValue === null) return;
    operationRef.current = true;
    setActivity('readingFinal');
    setError(null);
    try {
      const characteristic = await manager.readCharacteristicForDevice(device.id, SERVICE_UUID, CHAR_UUID);
      if (connectedRef.current?.id !== device.id) return;
      setPrediction(Buffer.from(characteristic.value ?? '', 'base64').toString('utf8'));
    } catch (readError) {
      setError(describeError(readError, 'Could not read the prediction'));
    } finally {
      operationRef.current = false;
      setActivity(null);
    }
  }, [writtenValue]);

  const disconnect = useCallback(async () => {
    const manager = managerRef.current;
    const device = connectedRef.current;
    if (!manager || !device || operationRef.current) return false;
    operationRef.current = true;
    setActivity('disconnecting');
    setError(null);
    disconnectSubscriptionRef.current?.remove();
    disconnectSubscriptionRef.current = null;
    try {
      await manager.cancelDeviceConnection(device.id);
      resetJourney();
      return true;
    } catch (disconnectError) {
      try {
        if (!(await manager.isDeviceConnected(device.id))) {
          resetJourney();
          return true;
        }
      } catch { /* Keep the connection visible so it can be retried. */ }
      disconnectSubscriptionRef.current = manager.onDeviceDisconnected(device.id, (unexpectedError) => {
        disconnectSubscriptionRef.current?.remove();
        disconnectSubscriptionRef.current = null;
        resetJourney();
        setError(unexpectedError ? describeError(unexpectedError, 'Device disconnected') : 'Device disconnected.');
      });
      setError(describeError(disconnectError, 'Could not disconnect'));
      return false;
    } finally {
      operationRef.current = false;
      setActivity(null);
    }
  }, [resetJourney]);

  return {
    bluetoothState, devices, isScanning, hasScanned, connectedDevice, activity, connectingId,
    firstValue, writtenValue, prediction, error, scan, stopScan, connect,
    readFirst, writeNames, readFinal, disconnect,
  };
}
