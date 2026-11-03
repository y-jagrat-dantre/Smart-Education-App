import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppScreen, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityAvatar, relativeCommunityTime } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { getCommunityNotifications, getCommunityNotificationPreferences, markCommunityNotificationRead, updateCommunityNotificationPreferences, type CommunityNotification, type CommunityNotificationPreferences } from '@/services/api';

function describe(item: CommunityNotification) {
  if (item.type === 'answer') return 'answered your question';
  if (item.type === 'reply') return 'replied to a discussion you joined';
  if (item.type === 'upvote') return 'found your answer helpful';
  if (item.type === 'accepted') return 'accepted your answer';
  return 'interacted with your community post';
}

export default function CommunityNotificationsScreen() {
  const [items, setItems] = useState<CommunityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<CommunityNotificationPreferences>({ answers: true, replies: true, upvotes: true, accepted: true });
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [data, settings] = await Promise.all([getCommunityNotifications(), getCommunityNotificationPreferences()]); setItems(data.notifications); setUnreadCount(data.unreadCount); setPreferences(settings.preferences); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const markAll = async () => {
    if (!unreadCount || busy) return;
    setBusy(true);
    try { await markCommunityNotificationRead(); setUnreadCount(0); setItems((current) => current.map((item) => ({ ...item, read: true }))); }
    catch (cause) { Alert.alert('Could not update notifications', cause instanceof Error ? cause.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const open = async (item: CommunityNotification) => {
    try { if (!item.read) { await markCommunityNotificationRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry)); setUnreadCount((count) => Math.max(0, count - 1)); } }
    catch { /* The question link can still open when the read receipt is offline. */ }
    if (item.questionId) router.push({ pathname: '/community/[id]', params: { id: item.questionId } });
  };
  const updatePreference = async (key: keyof CommunityNotificationPreferences, value: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try { await updateCommunityNotificationPreferences(next); }
    catch (cause) { setPreferences(previous); Alert.alert('Settings not saved', cause instanceof Error ? cause.message : 'Try again.'); }
  };

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Community</Text></Pressable>
    <View style={styles.heading}><View style={{ flex: 1, gap: 5 }}><Eyebrow>STAY IN THE LOOP</Eyebrow><Text style={uiStyles.heading}>Notifications</Text><Text style={styles.body}>{unreadCount ? `${unreadCount} unread updates` : 'You’re all caught up.'}</Text></View><Pressable accessibilityRole="button" onPress={() => setSettingsOpen((current) => !current)} style={styles.settingsButton}><Ionicons name="options-outline" size={16} color={colors.purpleDark} /><Text style={styles.readAllText}>Settings</Text></Pressable>{unreadCount ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void markAll()} style={styles.readAll}>{busy ? <ActivityIndicator size="small" color={colors.purple} /> : <Text style={styles.readAllText}>Mark all read</Text>}</Pressable> : null}</View>
    {settingsOpen ? <View style={styles.settingsCard}><Text style={styles.settingsTitle}>In-app activity alerts</Text>{([
      ['answers', 'New answers to your questions'], ['replies', 'Replies in discussions'], ['upvotes', 'Upvotes on your answers'], ['accepted', 'Accepted answers'],
    ] as [keyof CommunityNotificationPreferences, string][]).map(([key, label]) => <View key={key} style={styles.preferenceRow}><Text style={styles.preferenceLabel}>{label}</Text><Switch accessibilityLabel={label} value={preferences[key]} onValueChange={(value) => void updatePreference(key, value)} trackColor={{ true: colors.purple }} /></View>)}</View> : null}
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.purple} /><Text style={styles.body}>Loading notifications…</Text></View> : null}
    {error ? <View style={styles.empty}><Text style={styles.body}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.readAllText}>Try again</Text></Pressable></View> : null}
    {!loading && !error && !items.length ? <View style={styles.empty}><Ionicons name="notifications-outline" size={26} color={colors.purple} /><Text style={styles.emptyTitle}>No updates yet</Text><Text style={styles.body}>Answers, replies, and accepted solutions will appear here.</Text></View> : null}
    {items.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => void open(item)} style={[styles.notification, !item.read && styles.unread]}>
      <CommunityAvatar name={item.actor} size={42} />
      <View style={styles.copy}><Text style={styles.message}><Text style={styles.actor}>{item.actor}</Text> {describe(item)}</Text><Text style={styles.meta}>{relativeCommunityTime(item.createdAt)}</Text></View>
      {!item.read ? <View style={styles.dot} /> : null}
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, heading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  readAll: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.softMint }, readAllText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  settingsButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 12, backgroundColor: colors.softMint }, settingsCard: { gap: 4, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, settingsTitle: { color: colors.ink, fontSize: 11, fontWeight: '800', marginBottom: 3 }, preferenceRow: { minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, preferenceLabel: { color: colors.muted, fontSize: 10, flex: 1 },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 9 }, empty: { minHeight: 185, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  notification: { minHeight: 73, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, unread: { borderColor: '#C6DED1', backgroundColor: '#F5FAF5' }, copy: { flex: 1, gap: 5 }, message: { color: colors.muted, fontSize: 11, lineHeight: 17 }, actor: { color: colors.ink, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 9 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.purple },
});
