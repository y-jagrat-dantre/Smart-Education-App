import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, uiStyles } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useAppStore } from '@/state/app-store';

export default function NcertReaderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const book = useAppStore((state) => state.ncertBookLinks.find((item) => item.id === id));
  const update = useAppStore((state) => state.updateNcertBookLink);
  const [pageText, setPageText] = useState('1');
  const [sourceOpened, setSourceOpened] = useState(false);
  useEffect(() => { if (book) setPageText(String(book.lastReadPage || 1)); }, [book?.id]);

  if (!book) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>NCERT books</Text></Pressable><Text style={uiStyles.heading}>Book link not found</Text><Text style={uiStyles.body}>This link may have been removed from this device.</Text></AppScreen>;

  const savePage = (candidate = pageText) => {
    const parsed = Math.max(1, Math.min(99999, Math.round(Number(candidate) || 1)));
    setPageText(String(parsed));
    update(book.id, { lastReadPage: parsed });
  };
  const openSource = async () => {
    try {
      const source = new URL(book.url);
      if (/\.pdf$/i.test(source.pathname)) source.hash = `page=${book.lastReadPage || 1}`;
      await Linking.openURL(source.toString());
      setSourceOpened(true);
    } catch { Alert.alert('Could not open the book', 'Check that the official source link still works, then try again.'); }
  };
  const toggleBookmark = () => {
    const page = book.lastReadPage || 1;
    const bookmarks = book.bookmarkedPages.includes(page) ? book.bookmarkedPages.filter((value) => value !== page) : [...book.bookmarkedPages, page].sort((a, b) => a - b).slice(-100);
    update(book.id, { bookmarkedPages: bookmarks });
  };
  const confirmVerified = () => Alert.alert('Mark this source as checked?', 'Only do this if the original link opened the expected complete NCERT book or chapter.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Confirm book opened', onPress: () => { update(book.id, { verifiedAt: new Date().toISOString() }); setSourceOpened(false); } },
  ]);

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>NCERT books</Text></Pressable>
    <View style={styles.top}><Eyebrow>{book.verifiedAt ? 'SOURCE CHECKED' : 'SOURCE NOT VERIFIED'}</Eyebrow><Text style={uiStyles.heading}>{book.title}</Text><Text style={uiStyles.body}>{book.className} · {book.subject} · {book.language}{book.chapter ? ` · ${book.chapter}` : ''}</Text></View>
    <Card style={styles.readerNotice}><Ionicons name="open-outline" size={20} color={colors.purple} /><Text style={styles.readerNoticeText}>This book opens at its official source in your device's PDF or browser reader. Page position and bookmarks are saved here; zoom, search, and full-screen controls come from that reader.</Text></Card>
    <Card style={styles.pageCard}>
      <Text style={styles.pageHeading}>Reading position</Text>
      <View style={styles.pageControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={book.lastReadPage <= 1} onPress={() => savePage(String(book.lastReadPage - 1))} style={styles.pageButton}><Ionicons name="chevron-back" size={19} color={book.lastReadPage <= 1 ? colors.muted : colors.purple} /></Pressable>
        <View style={styles.pageNumber}><Text style={styles.pageHint}>LAST PAGE</Text><TextInput accessibilityLabel="Last read page number" value={pageText} onChangeText={setPageText} onBlur={() => savePage()} onSubmitEditing={() => savePage()} keyboardType="number-pad" style={styles.pageInput} maxLength={5} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next page" onPress={() => savePage(String((book.lastReadPage || 1) + 1))} style={styles.pageButton}><Ionicons name="chevron-forward" size={19} color={colors.purple} /></Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={toggleBookmark} style={styles.bookmark}><Ionicons name={book.bookmarkedPages.includes(book.lastReadPage) ? 'bookmark' : 'bookmark-outline'} size={17} color={colors.purple} /><Text style={styles.bookmarkText}>{book.bookmarkedPages.includes(book.lastReadPage) ? 'Remove bookmark' : 'Bookmark this page'}</Text></Pressable>
      {book.bookmarkedPages.length ? <Text style={styles.bookmarks}>Bookmarks: {book.bookmarkedPages.map((page) => `p. ${page}`).join(' · ')}</Text> : null}
    </Card>
    <ActionButton title="Open original book source" onPress={() => void openSource()} icon={<Ionicons name="open-outline" size={17} color="#FFFFFF" />} />
    {!book.verifiedAt && sourceOpened ? <ActionButton title="I confirmed the complete book opens" onPress={confirmVerified} secondary icon={<Ionicons name="checkmark-circle-outline" size={17} color={colors.purple} />} /> : null}
    {book.verifiedAt ? <Text style={styles.verified}>Checked by you on {new Date(book.verifiedAt).toLocaleDateString()}.</Text> : <Text style={styles.unverified}>This link remains unverified until you check the original source.</Text>}
    <Text style={styles.url} numberOfLines={3}>{book.url}</Text>
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, top: { gap: 7 },
  readerNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: colors.softPurple }, readerNoticeText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  pageCard: { alignItems: 'center', padding: 17, gap: 13 }, pageHeading: { color: colors.ink, fontSize: 14, fontWeight: '900' }, pageControls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }, pageButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border }, pageNumber: { minWidth: 100, alignItems: 'center', gap: 2 }, pageHint: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, pageInput: { width: 90, height: 44, color: colors.ink, fontSize: 23, fontWeight: '900', textAlign: 'center' }, bookmark: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 13, backgroundColor: colors.softPurple }, bookmarkText: { color: colors.purple, fontSize: 11, fontWeight: '800' }, bookmarks: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  verified: { color: colors.success, fontSize: 10, textAlign: 'center' }, unverified: { color: colors.amber, fontSize: 10, textAlign: 'center' }, url: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
