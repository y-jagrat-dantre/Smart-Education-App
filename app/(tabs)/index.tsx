import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';

export default function HomeScreen() {
  const allSongs = useAppStore((state) => state.songs);
  const quizAttempts = useAppStore((state) => state.quizAttempts);
  const activePomodoro = useAppStore((state) => state.activePomodoro);
  const { user } = useAuth();
  const songs = allSongs.filter((song) => song.ownerId === user?.id);
  const quizCount = quizAttempts.filter((attempt) => attempt.userId === user?.id).length;
  const latest = songs[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return <AppScreen>
    <View style={styles.header}>
      <View style={styles.brandLine}>
        <View style={styles.logo}><Ionicons name="pulse" size={21} color={colors.lime} /></View>
        <View><Text style={styles.brand}>SAMAJVED <Text style={styles.ai}>STUDY STUDIO</Text></Text><Text style={styles.tagline}>Make learning sound like you.</Text></View>
      </View>
  <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}><Ionicons name="person-outline" size={19} color={colors.purpleDark} /></Pressable>
    </View>

    <View style={styles.greet}><Eyebrow>YOUR STUDY SPACE</Eyebrow><Text style={uiStyles.heading}>{greeting}.</Text><Text style={uiStyles.body}>A fresh way to make the things you learn stay with you.</Text></View>

    <Pressable accessibilityRole="button" accessibilityLabel="Create a study song from your notes" onPress={() => router.push('/(tabs)/create')} style={({ pressed }) => [pressed && styles.heroPressed]}>
      <LinearGradient colors={[colors.midnight, '#176B5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}><Ionicons name="sparkles" size={13} color={colors.lime} /><Text style={styles.heroPillText}>YOUR NOTES, IN A NEW RHYTHM</Text></View>
          <Text style={styles.heroTitle}>Make your next idea stick.</Text>
          <Text style={styles.heroBody}>Turn class notes into songs, visuals, and quick reviews.</Text>
          <View style={styles.heroCta}><Text style={styles.heroCtaText}>Create a study song</Text><Ionicons name="arrow-forward" size={16} color={colors.midnight} /></View>
        </View>
        <View pointerEvents="none" style={styles.musicArt}>
          <View style={styles.musicHalo} /><View style={styles.musicCircle}><Ionicons name="musical-notes" size={32} color={colors.midnight} /></View>
          <View style={styles.waveform}>{[20, 34, 48, 29, 54, 38, 23].map((height, index) => <View key={index} style={[styles.waveBar, { height }]} />)}</View>
          <View style={styles.noteDot}><Ionicons name="sparkles" size={13} color={colors.midnight} /></View>
        </View>
      </LinearGradient>
    </Pressable>

    <Pressable accessibilityRole="button" accessibilityLabel="Open Pomodoro Focus Mode" onPress={() => router.push('/focus')} style={({ pressed }) => [styles.focusCard, pressed && styles.cardPressed]}>
      <View style={styles.focusIcon}><Ionicons name="timer-outline" size={21} color={colors.midnight} /></View>
      <View style={styles.focusCopy}><Text style={styles.whiteboardEyebrow}>POMODORO · FOCUS MODE</Text><Text style={styles.toolTitle}>{activePomodoro && activePomodoro.userId === user?.id ? activePomodoro.status === 'paused' ? 'Resume your focus session' : 'Return to your focus session' : 'Make time for focused study'}</Text><Text style={styles.toolMeta}>Study in a focused block, take a proper break, and track your progress.</Text></View>
      <View style={styles.focusArrow}><Ionicons name="arrow-forward" size={16} color={colors.midnight} /></View>
    </Pressable>

    <View style={styles.metrics}>
      <Card style={styles.metric}><View style={styles.metricHead}><View style={[styles.metricIcon, { backgroundColor: colors.softPurple }]}><Ionicons name="book-outline" size={17} color={colors.purpleDark} /></View><Text style={styles.metricLabel}>NOTEBOOKS</Text></View><Text style={styles.metricValue}>{songs.length}</Text><Text style={styles.metricCaption}>ready to revisit</Text></Card>
      <Card style={styles.metric}><View style={styles.metricHead}><View style={[styles.metricIcon, { backgroundColor: colors.softYellow }]}><Ionicons name="checkmark-done-outline" size={17} color={colors.amber} /></View><Text style={styles.metricLabel}>QUICK REVIEWS</Text></View><Text style={styles.metricValue}>{quizCount}</Text><Text style={styles.metricCaption}>completed so far</Text></Card>
    </View>

    <SectionTitle accessory={<Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/library')} hitSlop={8}><Text style={styles.sectionLink}>View library</Text></Pressable>}>Pick up where you left off</SectionTitle>
    {latest ? <Pressable accessibilityRole="button" onPress={() => router.push(`/song/${latest.id}`)} style={({ pressed }) => [pressed && styles.cardPressed]}><Card style={styles.continueCard}>
      <View style={styles.continueIcon}><Ionicons name="musical-notes" size={20} color={colors.purpleDark} /></View>
      <View style={styles.continueCopy}><Text style={styles.continueOverline}>LATEST NOTEBOOK</Text><Text style={styles.continueTitle} numberOfLines={1}>{latest.title}</Text><Text style={styles.continueMeta}>{latest.subject} · {latest.saved ? 'saved to your library' : 'draft in progress'}</Text></View>
      <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={17} color={colors.purpleDark} /></View>
    </Card></Pressable> : <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Ionicons name="document-text-outline" size={20} color={colors.purpleDark} /></View>
      <View style={styles.continueCopy}><Text style={styles.continueTitle}>Your first notebook starts here</Text><Text style={styles.continueMeta}>Add class notes, a photo, or a PDF to get going.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Add your first notes" onPress={() => router.push('/(tabs)/create')} style={styles.arrowCircle}><Ionicons name="arrow-forward" size={17} color={colors.purpleDark} /></Pressable>
    </Card>}

    <SectionTitle>Make more of your notes</SectionTitle>
    <View style={styles.tools}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/explore')} style={({ pressed }) => [styles.toolCard, pressed && styles.cardPressed]}><View style={[styles.toolIcon, { backgroundColor: colors.softPurple }]}><Ionicons name="layers-outline" size={20} color={colors.purpleDark} /></View><Text style={styles.toolTitle}>Open the studio</Text><Text style={styles.toolMeta}>Slides, mind maps, audio, and scene illustrations.</Text><Ionicons style={styles.toolArrow} name="arrow-forward" size={17} color={colors.purpleDark} /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/library')} style={({ pressed }) => [styles.toolCard, pressed && styles.cardPressed]}><View style={[styles.toolIcon, { backgroundColor: colors.softYellow }]}><Ionicons name="help-circle-outline" size={20} color={colors.amber} /></View><Text style={styles.toolTitle}>Test what stuck</Text><Text style={styles.toolMeta}>Recall key ideas from your notes.</Text><Ionicons style={styles.toolArrow} name="arrow-forward" size={17} color={colors.purpleDark} /></Pressable>
    </View>

    <Pressable accessibilityRole="button" onPress={() => router.push('/whiteboard')} style={({ pressed }) => [styles.whiteboardCard, pressed && styles.cardPressed]}>
      <View style={styles.whiteboardIcon}><Ionicons name="people-outline" size={20} color={colors.midnight} /></View>
      <View style={styles.whiteboardCopy}><Text style={styles.whiteboardEyebrow}>STUDY TOGETHER</Text><Text style={styles.toolTitle}>Solve it on a shared board</Text><Text style={styles.toolMeta}>Invite friends to draw through a question with you.</Text></View>
      <View style={styles.whiteboardArrow}><Ionicons name="arrow-forward" size={16} color={colors.midnight} /></View>
    </Pressable>

    <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/progress')} style={({ pressed }) => [styles.progressCard, pressed && styles.cardPressed]}>
      <View style={styles.progressIcon}><Ionicons name="stats-chart-outline" size={19} color={colors.purpleDark} /></View>
      <View style={styles.whiteboardCopy}><Text style={styles.whiteboardEyebrow}>YOUR LEARNING HABITS</Text><Text style={styles.toolTitle}>See your progress</Text><Text style={styles.toolMeta}>Track study time, subjects, goals, and topics to revisit.</Text></View>
      <View style={styles.whiteboardArrow}><Ionicons name="arrow-forward" size={16} color={colors.midnight} /></View>
    </Pressable>

    <View style={styles.footer}><Ionicons name="lock-closed-outline" size={13} color={colors.muted} /><Text style={styles.footerText}>Your drafts stay on this device. Shared boards sync with your study backend.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 46, height: 46, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.midnight },
  brand: { color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  ai: { color: colors.purpleDark, fontSize: 8, fontWeight: '800', letterSpacing: 1.05 },
  tagline: { color: colors.muted, marginTop: 3, fontSize: 11 },
  avatar: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.84 },
  greet: { gap: 5 },
  hero: { minHeight: 252, overflow: 'hidden', borderRadius: 28, padding: 21, position: 'relative', flexDirection: 'row', justifyContent: 'space-between' },
  heroPressed: { opacity: 0.92 },
  heroCopy: { width: '76%', zIndex: 2, gap: 12 },
  heroPill: { alignSelf: 'flex-start', minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroPillText: { fontSize: 8, color: '#ECF7DF', letterSpacing: 0.9, fontWeight: '800' },
  heroTitle: { maxWidth: 250, color: '#FFFFFF', fontSize: 26, lineHeight: 30, letterSpacing: -0.65, fontWeight: '800' },
  heroBody: { maxWidth: 220, color: '#DDECE7', fontSize: 12, lineHeight: 18 },
  heroCta: { alignSelf: 'flex-start', marginTop: 1, minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: radii.pill, backgroundColor: colors.lime },
  heroCtaText: { color: colors.midnight, fontSize: 11, fontWeight: '800' },
  musicArt: { position: 'absolute', right: 1, top: 42, width: 100, height: 160, alignItems: 'center', justifyContent: 'center' },
  musicHalo: { position: 'absolute', top: 10, right: -16, width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(230,248,233,0.18)' },
  musicCircle: { position: 'absolute', top: 27, right: 6, width: 63, height: 63, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  waveform: { position: 'absolute', bottom: 19, right: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  waveBar: { width: 4, borderRadius: 3, backgroundColor: 'rgba(228,243,232,0.72)' },
  noteDot: { position: 'absolute', top: 14, right: 67, width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3C37A' },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, minHeight: 116, padding: 14, gap: 4, borderRadius: 21 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  metricIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  metricCaption: { color: colors.muted, fontSize: 10 },
  sectionLink: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  continueCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: colors.surface },
  continueIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  continueCopy: { flex: 1, minWidth: 0, gap: 3 },
  continueOverline: { color: colors.purpleDark, fontSize: 8, fontWeight: '800', letterSpacing: 0.85 },
  continueTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  continueMeta: { color: colors.muted, marginTop: 1, fontSize: 10, lineHeight: 15 },
  arrowCircle: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.softMint },
  tools: { flexDirection: 'row', gap: 12 },
  toolCard: { flex: 1, minHeight: 154, position: 'relative', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 21, padding: 14 },
  cardPressed: { opacity: 0.84 },
  toolIcon: { width: 39, height: 39, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  toolTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  toolMeta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  toolArrow: { position: 'absolute', top: 16, right: 14 },
  whiteboardCard: { minHeight: 103, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#C7DFD3', backgroundColor: '#EAF3E8', borderRadius: 21 },
  progressCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 21 },
  progressIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.softPurple },
  focusCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#C7DFD3', backgroundColor: '#EAF3E8', borderRadius: 21 },
  focusIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lime },
  focusCopy: { flex: 1, gap: 3 },
  focusArrow: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7E9D7' },
  whiteboardIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lime },
  whiteboardCopy: { flex: 1, gap: 3 },
  whiteboardEyebrow: { color: colors.purpleDark, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  whiteboardArrow: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D7E9D7' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  footerText: { color: colors.muted, fontSize: 10, lineHeight: 15, flex: 1 },
});
