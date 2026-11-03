import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';

export default function LibraryScreen() {
  const allSongs = useAppStore((state) => state.songs);
  const { user } = useAuth();
  const songs = allSongs.filter((song) => song.ownerId === user?.id && song.saved);
  const deleteSong = useAppStore((state) => state.deleteSong);
  const remove = (id: string, title: string) => Alert.alert('Delete notebook?', `Deleting “${title}” removes its source notes, lyrics, photo attachment, saved study formats, and topic progress from this device. Completed timer sessions and quiz results remain in your history.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete notebook', style: 'destructive', onPress: () => deleteSong(id) },
  ]);
  return <AppScreen>
    <View style={styles.top}><Eyebrow>YOUR STUDY SHELF</Eyebrow><Text style={uiStyles.heading}>Your library</Text><Text style={uiStyles.body}>Keep your favorite notebooks close. Open one to edit lyrics, check the source, or take a quick quiz.</Text></View>
    <Pressable accessibilityRole="button" onPress={() => router.push('/ncert-books')} style={({ pressed }) => [styles.booksLink, pressed && styles.pressed]}><View style={styles.booksIcon}><Ionicons name="book-outline" size={20} color={colors.purple} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.booksTitle}>NCERT books & links</Text><Text style={styles.booksCopy}>Add the official book URLs you want to use</Text></View><Ionicons name="arrow-forward" size={17} color={colors.purple} /></Pressable>
    <SectionTitle accessory={<Text style={styles.count}>{songs.length} {songs.length === 1 ? 'item' : 'items'}</Text>}>Saved notebooks</SectionTitle>
    {songs.length ? songs.map((song) => <Card key={song.id} style={styles.songCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${song.title}`} onPress={() => router.push(`/song/${song.id}`)} style={({ pressed }) => [styles.songRow, pressed && styles.pressed]}>
        <View style={styles.songIcon}><Ionicons name={song.audioUrl ? 'musical-notes' : 'text'} size={20} color={colors.purple} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text><Text style={styles.songMeta}>{song.subject} · {(song.language ?? 'en') === 'hi' ? 'हिन्दी' : 'English'} · {song.audioUrl ? 'Audio ready' : 'Lyrics only'} · {new Date(song.createdAt).toLocaleDateString()}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <View style={styles.actions}><Pressable onPress={() => router.push(`/quiz/${song.id}`)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Ionicons name="help-circle-outline" size={16} color={colors.success} /><Text style={styles.actionText}>Quiz</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${song.title} notebook`} onPress={() => remove(song.id, song.title)} style={({ pressed }) => [styles.action, styles.actionDanger, pressed && styles.pressed]}><Ionicons name="trash-outline" size={15} color={colors.danger} /><Text style={[styles.actionText, { color: colors.danger }]}>Delete notebook</Text></Pressable></View>
    </Card>) : <Card style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="library-outline" size={25} color={colors.purple} /></View><Text style={styles.emptyTitle}>Your library is ready</Text><Text style={styles.emptyBody}>Create a lyric draft and save it here. You can return to edit it or quiz yourself later.</Text><ActionButton title="Create your first draft" onPress={() => router.push('/(tabs)/create')} /></Card>}
    <View style={styles.note}><Ionicons name="phone-portrait-outline" size={15} color={colors.muted} /><Text style={styles.noteText}>Saved material is stored locally. Cloud sync is not connected.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 7, marginBottom: 2 },
  booksLink: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  booksIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  booksTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  booksCopy: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  count: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  songCard: { padding: 15, gap: 13, borderRadius: 22 },
  songRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 12 },
  songIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  songTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  songMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.softMint },
  actionDanger: { backgroundColor: '#FFF7F4', borderWidth: 1, borderColor: '#EBD5D0' },
  pressed: { opacity: 0.84 },
  actionText: { color: colors.success, fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', padding: 24, gap: 14, marginTop: 8 },
  emptyIcon: { width: 66, height: 66, borderRadius: 23, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  note: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 3 },
  noteText: { color: colors.muted, fontSize: 11 },
});
