import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { createGuestSession, endGuestSession, getBackendHealth, hasBackend, hasGuestSession } from '@/services/api';
import { useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';

export default function ProfileScreen() {
  const [sessionActive, setSessionActive] = useState(hasGuestSession());
  const [busy, setBusy] = useState(false);
  const [aiService, setAiService] = useState<'checking' | 'ready' | 'setup' | 'offline'>('checking');
  const [imageService, setImageService] = useState<'checking' | 'ready' | 'setup' | 'offline'>('checking');
  const { user, signOut } = useAuth();
  const clearLocalData = useAppStore((state) => state.clearLocalData);
  useFocusEffect(useCallback(() => {
    let active = true;
    setSessionActive(hasGuestSession());
    if (!hasBackend) { setAiService('setup'); setImageService('setup'); }
    else {
      setAiService('checking');
      setImageService('checking');
      void getBackendHealth()
        .then((health) => {
          if (!active) return;
          setAiService(health.aiConfigured ? 'ready' : 'setup');
          setImageService(health.imageGenerationConfigured ? 'ready' : 'setup');
        })
        .catch(() => { if (active) { setAiService('offline'); setImageService('offline'); } });
    }
    return () => { active = false; };
  }, []));
  const connect = async () => {
    setBusy(true);
    try { await createGuestSession(); setSessionActive(true); Alert.alert('Study services connected', 'AI study guides, song requests, and scene illustration requests can now use your temporary guest session.'); }
    catch (error) { Alert.alert('Could not connect', error instanceof Error ? error.message : 'Start the backend and try again.'); }
    finally { setBusy(false); }
  };
  const disconnect = () => { endGuestSession(); setSessionActive(false); Alert.alert('Guest session ended', 'Your local saved study material was not changed.'); };
  const confirmClear = () => Alert.alert('Clear this device?', 'This removes notebooks, source notes, saved formats, NCERT links, topic progress, study sessions, quiz results, goals, and drafts from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear data', style: 'destructive', onPress: clearLocalData },
  ]);
  return <AppScreen>
    <View style={styles.top}><Eyebrow>ACCOUNT & SETTINGS</Eyebrow><Text style={uiStyles.heading}>Your learning space</Text><Text style={uiStyles.body}>Manage your account, study services, and the material saved on this device.</Text></View>
    <Card style={styles.account}>
      <View style={styles.accountIcon}><Ionicons name="person-outline" size={22} color={colors.purple} /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={styles.accountTitle}>{user?.name ?? 'Student account'}</Text><Text style={styles.accountMeta}>{user?.email ?? 'Signed in'}</Text></View>
      <View style={styles.accountBadge}><View style={styles.badgeDot} /><Text style={styles.badgeText}>ACTIVE</Text></View>
    </Card>
    <Pressable onPress={() => { void signOut(); router.replace('/login'); }} style={styles.signOut}><Ionicons name="log-out-outline" size={17} color={colors.danger} /><Text style={styles.signOutText}>Sign out of student account</Text></Pressable>
    <Card style={styles.account}>
      <View style={styles.accountIcon}><Ionicons name="person-outline" size={22} color={colors.purple} /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={styles.accountTitle}>Guest mode</Text><Text style={styles.accountMeta}>{sessionActive ? 'Temporary session active · clears when the app closes' : 'Your saved drafts stay on this device.'}</Text></View>
    </Card>
    {sessionActive ? <Pressable onPress={disconnect} style={styles.signOut}><Ionicons name="log-out-outline" size={17} color={colors.danger} /><Text style={styles.signOutText}>End guest session</Text></Pressable> : <ActionButton title={busy ? 'Connecting…' : 'Connect to study services'} onPress={connect} disabled={busy || !hasBackend} icon={<Ionicons name="link-outline" size={17} color="#FFFFFF" />} />}

    <SectionTitle>Study services</SectionTitle>
    <Card style={styles.connections}>
      <View style={styles.serviceRow}><View style={[styles.serviceIcon, { backgroundColor: colors.softPurple }]}><Ionicons name="sparkles-outline" size={17} color={aiService === 'ready' ? colors.purple : colors.muted} /></View><View style={{ flex: 1 }}><Text style={styles.serviceName}>Gemini text extraction</Text><Text style={styles.serviceMeta}>{aiService === 'ready' ? 'Connected · photo and PDF extraction are available' : aiService === 'checking' ? 'Checking Gemini service…' : aiService === 'offline' ? 'Backend is offline · run npm run backend' : hasBackend ? 'Backend is reachable, but GEMINI_API_KEY is not configured' : 'Set EXPO_PUBLIC_API_URL in .env (needed for production or tunnel mode)'}</Text></View><View style={[styles.statusDot, { backgroundColor: aiService === 'ready' ? colors.success : aiService === 'checking' ? colors.amber : aiService === 'offline' ? colors.danger : '#C4C5CC' }]} /></View>
      <View style={styles.divider} />
      <View style={styles.serviceRow}><View style={[styles.serviceIcon, { backgroundColor: colors.softPeach }]}><Ionicons name="musical-note-outline" size={17} color="#A85A32" /></View><View style={{ flex: 1 }}><Text style={styles.serviceName}>AceMusic · ACE-Step 1.5</Text><Text style={styles.serviceMeta}>Vocal song generation · hosted API</Text></View></View>
      <View style={styles.divider} />
      <View style={styles.serviceRow}><View style={[styles.serviceIcon, { backgroundColor: colors.softMint }]}><Ionicons name="images-outline" size={17} color={imageService === 'ready' ? colors.success : colors.muted} /></View><View style={{ flex: 1 }}><Text style={styles.serviceName}>Gemini scene illustrations</Text><Text style={styles.serviceMeta}>{imageService === 'ready' ? 'Gemini key detected · image model access is checked when generating' : imageService === 'checking' ? 'Checking Gemini image service…' : imageService === 'offline' ? 'Backend is offline · run npm run backend' : hasBackend ? 'Add GEMINI_API_KEY to backend/.env; image model access may require billing' : 'Configure EXPO_PUBLIC_API_URL for this build'}</Text></View><View style={[styles.statusDot, { backgroundColor: imageService === 'ready' ? colors.success : imageService === 'checking' ? colors.amber : '#C4C5CC' }]} /></View>
    </Card>

    <SectionTitle>Privacy & storage</SectionTitle>
    <Card style={styles.privacyCard}><Ionicons name="phone-portrait-outline" size={19} color={colors.purple} /><Text style={styles.privacyText}>Notes, topic progress, study sessions, quiz results, and goals are stored on this device and do not sync between devices. Notes are sent to the AI provider only when you request generation. Guest sessions are temporary and are not user accounts.</Text></Card>
    <Pressable onPress={confirmClear} style={styles.clear}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.clearText}>Clear local study data</Text></Pressable>
      <Text style={styles.version}>SAMAJVED AI · Guest development mode</Text>
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 7 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  accountBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.softMint },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  badgeText: { color: colors.success, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  accountTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  accountMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4' },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  connections: { paddingVertical: 9, paddingHorizontal: 18, gap: 0 },
  serviceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softMint },
  serviceName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  serviceMeta: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  divider: { height: 1, backgroundColor: colors.border },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, padding: 18 },
  privacyText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19 },
  clear: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4' },
  clearText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  version: { textAlign: 'center', color: colors.muted, fontSize: 10, letterSpacing: 0.25 },
});
