import { Buffer } from 'buffer';
import { useRef, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { State, type Device } from 'react-native-ble-plx';
import { CHAR_UUID, SERVICE_UUID, useBleLab } from '@/lib/useBleLab';

const C = {
  ink: '#19191B', paper: '#F8F1E8', coral: '#FF7077', teal: '#55D1C8',
  yellow: '#FFE776', lilac: '#B49AF4', blue: '#83CBE8',
  muted: '#66615D', white: '#FFFFFF',
};

type TabKey = 'devices' | 'lab';

function Card({ color = C.white, children }: { color?: string; children: ReactNode }) {
  return <View style={s.cardShadow}><View style={[s.card, { backgroundColor: color }]}>{children}</View></View>;
}

function Action({ title, color = C.ink, dark = false, disabled = false, onPress }: {
  title: string; color?: string; dark?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.buttonShadow, disabled && s.disabled, pressed && s.pressed]}>
      <View style={[s.button, { backgroundColor: color }]}>
        <Text style={[s.buttonText, dark && { color: C.white }]}>{title}</Text>
        <Text style={[s.buttonArrow, dark && { color: C.white }]}>↗</Text>
      </View>
    </Pressable>
  );
}

function StepTitle({ n, title, subtitle, done, color }: {
  n: string; title: string; subtitle: string; done: boolean; color: string;
}) {
  return (
    <View style={s.stepHead}>
      <View style={[s.stepNumber, { backgroundColor: done ? C.teal : color }]}>
        <Text style={s.stepNumberText}>{done ? '✓' : n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepSubtitle}>{subtitle}</Text>
      </View>
      <Text style={s.spark}>{done ? '✦' : '✳'}</Text>
    </View>
  );
}

function DeviceRow({ device, onPress, disabled, connecting }: {
  device: Device; onPress: () => void; disabled: boolean; connecting: boolean;
}) {
  const label = device.name || device.localName || 'Unnamed BLE device';
  const unavailable = device.isConnectable === false;
  const advertised = device.serviceUUIDs?.some((uuid) => uuid.toLowerCase() === SERVICE_UUID);
  const chip = connecting ? 'CONNECTING...' : unavailable ? 'UNAVAILABLE' : 'CONNECT ↗';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={'Connect to ' + label}
      accessibilityState={{ disabled: disabled || unavailable }}
      disabled={disabled || unavailable} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.deviceRow, unavailable && s.unavailableRow, pressed && { backgroundColor: C.yellow }]}>
      <View style={s.deviceMark}><Text style={s.deviceMarkText}>⌁</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.deviceName} numberOfLines={1}>{label}</Text>
        <Text style={s.deviceId} numberOfLines={1}>{device.id}</Text>
        {advertised && <Text style={s.targetHint}>TARGET SERVICE ADVERTISED</Text>}
      </View>
      <View style={[s.rssi, connecting && { backgroundColor: C.yellow }]}>
        <Text style={s.rssiText}>{chip}</Text>
      </View>
    </Pressable>
  );
}

function BottomTab({ label, symbol, active, onPress }: {
  label: string; symbol: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}
      onPress={onPress} style={[s.tab, active && s.tabActive]}>
      <Text style={s.tabSymbol}>{symbol}</Text>
      <Text style={s.tabLabel}>{label}</Text>
    </Pressable>
  );
}

export default function Index() {
  const ble = useBleLab();
  const scrollRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<TabKey>('devices');
  const [deviceQuery, setDeviceQuery] = useState('');
  const [name, setName] = useState('');
  const [buddy, setBuddy] = useState('');
  const connected = ble.connectedDevice !== null;
  const busy = ble.activity !== null;
  const radioReady = ble.bluetoothState === State.PoweredOn;
  const payload = name.trim() + ', ' + buddy.trim();
  const bytes = name.trim() && buddy.trim() ? Buffer.byteLength(payload, 'utf8') : 0;
  const canWrite = connected && !!name.trim() && !!buddy.trim();
  const visibleDevices = ble.devices.filter((device) =>
    (device.name || device.localName || 'Unnamed BLE device').toLowerCase().includes(deviceQuery.trim().toLowerCase()) ||
    device.id.toLowerCase().includes(deviceQuery.trim().toLowerCase())
  );

  const openTab = (next: TabKey) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const connectToDevice = async (device: Device) => {
    const success = await ble.connect(device);
    if (success) openTab('lab');
  };

  const disconnectDevice = async () => {
    const success = await ble.disconnect();
    if (success) {
      openTab('devices');
      Alert.alert('Disconnected', 'Device has been disconnected.');
    }
  };

  const writeToDevice = async () => {
    const success = await ble.writeNames(name, buddy);
    if (success) Alert.alert('Write Success', `Value "${name.trim()}, ${buddy.trim()}" written successfully.`);
  };

  const startScan = () => {
    setDeviceQuery('');
    void ble.scan();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.logo}><Text style={s.logoText}>✦</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.brand}>Bluetooth LE App</Text>
              <Text style={s.brandSub}>CLASSROOM BLE LAB</Text>
            </View>
            <View style={s.dots}>
              <View style={[s.dot, { backgroundColor: C.coral }]} />
              <View style={[s.dot, { backgroundColor: C.lilac }]} />
              <View style={[s.dot, { backgroundColor: C.teal }]} />
            </View>
          </View>

          <Card color={C.coral}>
            <View style={s.hero}>
              <View style={s.heroPill}><Text style={s.heroPillText}>BLE • CLASS CHALLENGE</Text></View>
              <Text style={s.heroTitle}>{tab === 'lab' ? 'READ.\nWRITE.' : 'SCAN.\nCONNECT.'}</Text>
              <Text style={s.heroCopy}>{tab === 'lab'
                  ? 'Read the first value, send both names, then read again for your grade prediction.'
                  : 'Find your classroom BLE device, then follow the read and write steps.'}</Text>
              <View style={s.heroArt} pointerEvents="none">
                <View style={s.heroOrbBack} />
                <View style={s.heroOrb}><Text style={s.heroOrbText}>A+</Text></View>
                <Text style={s.heroStar}>✳</Text>
              </View>
            </View>
          </Card>

          <View style={s.status}>
            <View style={[s.statusDot, { backgroundColor: radioReady ? C.teal : C.coral }]} />
            <Text style={s.statusText}>{connected ? 'Device connected' : radioReady ? 'Bluetooth is ready' : 'Check Bluetooth on your phone'}</Text>
            <View style={[s.statusPill, { backgroundColor: connected ? C.teal : radioReady ? C.yellow : C.coral }]}>
              <Text style={s.statusPillText}>{connected ? 'CONNECTED' : radioReady ? 'READY TO SCAN' : 'CHECK BLUETOOTH'}</Text>
            </View>
          </View>

          {tab === 'devices' && (
          <>
          <View style={s.kicker}><Text style={s.kickerText}>{connected ? 'DEVICE / CONNECTED' : '00 / CONNECT'}</Text><View style={s.kickerLine} /></View>
          <Card color={C.yellow}>
            <View style={s.inner}>
              <View style={s.connectHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.connectTitle}>{connected ? 'Device connected' : 'Find your device'}</Text>
                  <Text style={s.connectSub}>{connected ? 'Open Lab to read, write, and disconnect.' : 'Select a nearby BLE device to begin.'}</Text>
                </View>
                <View style={s.antenna}><Text style={s.antennaText}>⌁</Text></View>
              </View>
              {connected ? (
                <>
                  <View style={s.connectedBox}>
                    <View style={s.liveDot} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.connectedEyebrow}>CONNECTED TO</Text>
                      <Text style={s.connectedName} numberOfLines={1}>{ble.connectedDevice?.name || ble.connectedDevice?.localName || 'BLE device'}</Text>
                      <Text style={s.deviceId} numberOfLines={1}>{ble.connectedDevice?.id}</Text>
                    </View>
                  </View>
                  <View style={s.openLab}>
                    <Action title="Open Lab" color={C.teal} onPress={() => openTab('lab')} />
                  </View>
                </>
              ) : (
                <>
                  <Action title={ble.isScanning ? 'Stop scanning' : ble.activity === 'connecting' ? 'Connecting...' : '◎  Scan devices'}
                    color={C.ink} dark disabled={busy} onPress={ble.isScanning ? ble.stopScan : startScan} />
                  {ble.isScanning && <Text style={s.hint}>Searching nearby devices for up to 12 seconds...</Text>}
                  {ble.hasScanned && !ble.isScanning && ble.devices.length === 0 &&
                    <Text style={s.hint}>No devices found. Make sure the device is on and nearby, then scan again.</Text>}
                  {ble.devices.length > 0 && (
                    <View style={s.deviceList}>
                      <Text style={s.listTitle}>Devices found  {ble.devices.length}</Text>
                      <TextInput style={s.searchInput} value={deviceQuery} onChangeText={setDeviceQuery}
                        placeholder="Search by name or ID" placeholderTextColor="#766F68"
                        accessibilityLabel="Search devices" />
                      {visibleDevices.length === 0 && <Text style={s.hint}>No devices match this search.</Text>}
                      {visibleDevices.map((d) =>
                        <DeviceRow key={d.id} device={d} disabled={busy}
                          connecting={ble.connectingId === d.id}
                          onPress={() => { void connectToDevice(d); }} />)}
                    </View>
                  )}
                  <Text style={s.connectHint}>The classroom device may appear as “Mobile App 169”. Reading and writing use the UUIDs supplied in the assignment.</Text>
                </>
              )}
            </View>
          </Card>
          </>
          )}

          {tab === 'lab' && connected && (
          <>
          <View style={s.kicker}><Text style={s.kickerText}>THE 3-STEP MISSION</Text><View style={s.kickerLine} /></View>
          <Card>
            <View style={s.inner}>
              <StepTitle n="01" title="Read the first value" subtitle="Get the initial characteristic value" done={ble.firstValue !== null} color={C.lilac} />
              <View style={s.valueBox}>
                <Text style={s.valueLabel}>INITIAL READ / VALUE</Text>
                <Text style={[s.valueText, ble.firstValue === null && s.placeholder]}>
                  {ble.firstValue === null ? 'Waiting for the first read...' : ble.firstValue || '(Empty value)'}
                </Text>
              </View>
              <Action title={ble.activity === 'readingFirst' ? 'Reading...' : ble.firstValue === null ? '↘  Read value' : '↘  Read again'}
                color={C.lilac} disabled={busy} onPress={ble.readFirst} />
            </View>
          </Card>

          <View style={s.connector}><Text style={s.connectorText}>↓</Text></View>
          <Card>
            <View style={s.inner}>
              <StepTitle n="02" title="Write both names" subtitle="Write your name and your buddy's name" done={ble.writtenValue !== null} color={C.coral} />
              <Text style={s.fieldLabel}>YOUR NAME</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Enter your name"
                placeholderTextColor="#948C84" autoCapitalize="words" maxLength={40} accessibilityLabel="Your name" />
              <Text style={s.fieldLabel}>BUDDY'S NAME</Text>
              <TextInput style={s.input} value={buddy} onChangeText={setBuddy} placeholder="Enter your buddy's name"
                placeholderTextColor="#948C84" autoCapitalize="words" maxLength={40} accessibilityLabel="Buddy's name" />
              <View style={s.payloadBox}>
                <Text style={s.payloadLabel}>VALUE TO WRITE</Text>
                <Text style={s.payloadValue}>{name.trim() && buddy.trim() ? payload : 'Your name, buddy name'}</Text>
                {bytes > 20 && <Text style={s.payloadWarning}>Value is {bytes} bytes. Some devices may reject long values.</Text>}
              </View>
              <Action title={ble.activity === 'writing' ? 'Writing...' : '↗  Write value'}
                color={C.coral} disabled={!canWrite || busy} onPress={writeToDevice} />
              {ble.writtenValue !== null && <Text style={s.success}>✓ Written: {ble.writtenValue}</Text>}
            </View>
          </Card>

          <View style={s.connector}><Text style={s.connectorText}>↓</Text></View>
          <Card color={C.teal}>
            <View style={s.inner}>
              <StepTitle n="03" title="Read the prediction" subtitle="Read the characteristic after writing" done={ble.prediction !== null} color={C.yellow} />
              <View style={s.resultBox}>
                <Text style={s.resultEyebrow}>YOUR PREDICTION ✦</Text>
                <Text style={[s.resultText, ble.prediction === null && s.resultPlaceholder]}>
                  {ble.prediction === null ? 'Your predicted grade will appear here' : ble.prediction || '(Device returned an empty value)'}
                </Text>
                <Text style={s.resultNote}>{ble.prediction === null ? 'The result comes from the device after a second read.' : 'Value received from the BLE device'}</Text>
              </View>
              <Action title={ble.activity === 'readingFinal' ? 'Reading...' : ble.prediction === null ? '✦  Read the prediction' : '✦  Read result again'}
                color={C.ink} dark disabled={ble.writtenValue === null || busy} onPress={ble.readFinal} />
            </View>
          </Card>
          <View style={s.disconnectBlock}>
            <Action title={ble.activity === 'disconnecting' ? 'Disconnecting...' : 'Disconnect device'}
              color={C.yellow} disabled={busy} onPress={disconnectDevice} />
          </View>
          </>
          )}

          {tab === 'lab' && !connected && (
            <>
              <View style={s.kicker}><Text style={s.kickerText}>LAB / LOCKED</Text><View style={s.kickerLine} /></View>
              <Card color={C.lilac}>
                <View style={s.inner}>
                  <Text style={s.connectTitle}>Connect a device first</Text>
                  <Text style={s.guideText}>Scan and connect from Devices. The read, write, and disconnect controls will appear here.</Text>
                  <Action title="Go to Devices" color={C.white} onPress={() => openTab('devices')} />
                </View>
              </Card>
            </>
          )}

          <View style={s.footer}>
            <Text style={s.footerStars}>✦  ✳  ✦</Text>
            <Text style={s.footerTitle}>READY FOR CLASS.</Text>
            <Text style={s.footerCopy}>Capture your results and submit the screenshots to Google Classroom.</Text>
            <Text style={s.uuids}>SERVICE {SERVICE_UUID}{'\n'}CHARACTERISTIC {CHAR_UUID}</Text>
          </View>
        </ScrollView>
        {ble.error &&
          <View style={s.bottomError} accessibilityRole="alert">
            <Text style={s.errorMark}>!</Text><Text style={s.errorText}>{ble.error}</Text>
          </View>}
        <View style={s.bottomNav}>
          <BottomTab label="Devices" symbol="◎" active={tab === 'devices'} onPress={() => openTab('devices')} />
          <BottomTab label="Lab" symbol="✦" active={tab === 'lab'} onPress={() => openTab('lab')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 38, maxWidth: 650, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  logo: { width: 46, height: 46, borderWidth: 2, borderColor: C.ink, borderRadius: 12, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginRight: 10, transform: [{ rotate: '-6deg' }] },
  logoText: { color: C.ink, fontSize: 29, fontWeight: '900' },
  brand: { color: C.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink },
  cardShadow: { backgroundColor: C.ink, borderRadius: 23, paddingRight: 5, paddingBottom: 6, marginBottom: 4 },
  card: { borderColor: C.ink, borderWidth: 2, borderRadius: 20, overflow: 'hidden' },
  hero: { minHeight: 223, padding: 22, overflow: 'hidden' },
  heroPill: { backgroundColor: C.yellow, borderWidth: 2, borderColor: C.ink, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', zIndex: 2 },
  heroPillText: { fontSize: 10, fontWeight: '900', color: C.ink, letterSpacing: 0.6 },
  heroTitle: { fontSize: 37, lineHeight: 46, fontWeight: '900', color: C.ink, marginTop: 15, letterSpacing: -1.2, zIndex: 2 },
  heroCopy: { fontSize: 13, lineHeight: 20, color: C.ink, fontWeight: '600', maxWidth: '72%', marginTop: 9, zIndex: 2 },
  heroArt: { position: 'absolute', right: -14, top: 42, width: 142, height: 146, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] },
  heroOrbBack: { position: 'absolute', width: 99, height: 99, borderColor: C.ink, borderWidth: 3, borderRadius: 50, backgroundColor: C.lilac, transform: [{ translateX: 13 }, { translateY: 11 }] },
  heroOrb: { width: 99, height: 99, borderColor: C.ink, borderWidth: 3, borderRadius: 50, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center' },
  heroOrbText: { color: C.ink, fontSize: 38, fontWeight: '900', letterSpacing: -3 },
  heroStar: { position: 'absolute', top: -7, right: 22, fontSize: 30, color: C.ink },
  status: { minHeight: 48, backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 18, marginBottom: 18, gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink },
  statusText: { color: C.ink, fontSize: 11, fontWeight: '800', flex: 1 },
  statusPill: { borderWidth: 1.5, borderColor: C.ink, borderRadius: 15, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 8, fontWeight: '900', color: C.ink, letterSpacing: 0.4 },
  bottomError: { backgroundColor: '#FFE0DD', borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', gap: 10, alignItems: 'center' },
  errorMark: { color: C.ink, fontSize: 19, fontWeight: '900' },
  errorText: { flex: 1, color: C.ink, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7, marginBottom: 12 },
  kickerText: { color: C.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  kickerLine: { height: 2, backgroundColor: C.ink, flex: 1 },
  inner: { padding: 18 },
  connectHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 8 },
  connectTitle: { color: C.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  connectSub: { color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 250 },
  antenna: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: C.ink, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  antennaText: { color: C.ink, fontSize: 32, fontWeight: '900', marginTop: -8 },
  buttonShadow: { backgroundColor: C.ink, borderRadius: 15, paddingBottom: 4, paddingRight: 4 },
  disabled: { opacity: 0.48 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  button: { borderColor: C.ink, borderWidth: 2, borderRadius: 13, minHeight: 50, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonText: { color: C.ink, fontWeight: '900', fontSize: 15 },
  buttonArrow: { color: C.ink, fontWeight: '900', fontSize: 22 },
  hint: { color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 12, fontWeight: '700' },
  connectHint: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 13 },
  deviceList: { borderTopWidth: 2, borderColor: C.ink, marginTop: 18, paddingTop: 12 },
  listTitle: { color: C.ink, fontSize: 12, fontWeight: '900', marginBottom: 9 },
  searchInput: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.ink, borderRadius: 11, minHeight: 43, paddingHorizontal: 12, color: C.ink, fontSize: 13, marginBottom: 12 },
  deviceRow: { backgroundColor: C.white, borderColor: C.ink, borderWidth: 1.5, borderRadius: 12, padding: 9, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  unavailableRow: { opacity: 0.55 },
  deviceMark: { width: 33, height: 33, borderRadius: 9, borderColor: C.ink, borderWidth: 1.5, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  deviceMarkText: { fontSize: 22, fontWeight: '900', color: C.ink, marginTop: -5 },
  deviceName: { color: C.ink, fontSize: 12, fontWeight: '900' },
  deviceId: { color: C.muted, fontSize: 10, marginTop: 2 },
  targetHint: { color: '#126455', fontSize: 8, fontWeight: '900', marginTop: 3 },
  rssi: { backgroundColor: C.paper, borderColor: C.ink, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  rssiText: { color: C.ink, fontSize: 9, fontWeight: '800' },
  connectedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: C.ink, backgroundColor: C.white, borderRadius: 13, padding: 12 },
  liveDot: { backgroundColor: C.teal, borderWidth: 2, borderColor: C.ink, width: 16, height: 16, borderRadius: 8 },
  connectedEyebrow: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  connectedName: { color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  openLab: { marginTop: 14 },
  disconnectBlock: { marginTop: 18 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  stepNumber: { width: 40, height: 40, borderWidth: 2, borderColor: C.ink, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: C.ink, fontSize: 17, fontWeight: '900' },
  stepTitle: { color: C.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  stepSubtitle: { color: C.muted, fontSize: 11, marginTop: 2 },
  spark: { color: C.ink, fontSize: 21, fontWeight: '900' },
  valueBox: { borderWidth: 2, borderColor: C.ink, backgroundColor: C.paper, borderRadius: 13, padding: 14, minHeight: 83, marginBottom: 14 },
  valueLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  valueText: { color: C.ink, fontSize: 17, fontWeight: '800', marginTop: 8, lineHeight: 23 },
  placeholder: { color: '#8A827A', fontWeight: '600', fontSize: 13 },
  connector: { height: 32, alignItems: 'center', justifyContent: 'center' },
  connectorText: { color: C.ink, fontSize: 21, fontWeight: '900' },
  fieldLabel: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 7 },
  input: { backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, paddingVertical: 9, color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 13 },
  payloadBox: { backgroundColor: C.yellow, borderColor: C.ink, borderWidth: 2, borderRadius: 12, padding: 11, marginTop: 2, marginBottom: 15 },
  payloadLabel: { color: C.ink, fontSize: 10, fontWeight: '900' },
  payloadValue: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  payloadWarning: { color: '#7F362B', fontSize: 10, fontWeight: '800', marginTop: 6 },
  success: { color: '#126455', fontSize: 12, fontWeight: '800', marginTop: 12 },
  resultBox: { backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 142, marginBottom: 15 },
  resultEyebrow: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  resultText: { color: C.ink, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  resultPlaceholder: { color: '#68615A', fontSize: 16, fontWeight: '700' },
  resultNote: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  guideText: { color: C.ink, fontSize: 13, lineHeight: 20, marginTop: 12, marginBottom: 12 },
  footer: { alignItems: 'center', paddingTop: 30 },
  footerStars: { color: C.ink, fontSize: 18 },
  footerTitle: { color: C.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.5, marginTop: 8 },
  footerCopy: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 285, marginTop: 4 },
  uuids: { color: '#948C84', fontSize: 9, lineHeight: 15, textAlign: 'center', marginTop: 18, letterSpacing: 0.2 },
  bottomNav: { backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 5 },
  tab: { flex: 1, minHeight: 57, backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: C.teal },
  tabSymbol: { color: C.ink, fontSize: 19, fontWeight: '900', lineHeight: 22 },
  tabLabel: { color: C.ink, fontSize: 11, fontWeight: '900', marginTop: 2 },
});
