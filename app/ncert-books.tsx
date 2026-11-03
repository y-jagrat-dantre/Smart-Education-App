import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useAppStore, type NcertBookLink } from '@/state/app-store';

export default function NcertBooksScreen() {
  const books = useAppStore((state) => state.ncertBookLinks);
  const addBook = useAppStore((state) => state.addNcertBookLink);
  const deleteBook = useAppStore((state) => state.deleteNcertBookLink);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState<NcertBookLink['language']>('English');

  const save = () => {
    const cleanTitle = title.trim();
    const cleanUrl = url.trim();
    if (!cleanTitle || !className.trim() || !subject.trim() || !cleanUrl) {
      Alert.alert('Complete the book details', 'Add a title, class, subject, and the NCERT link you want to save.');
      return;
    }
    let parsed: URL;
    try { parsed = new URL(cleanUrl); }
    catch { Alert.alert('Check the link', 'Enter a complete URL beginning with https://.'); return; }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || cleanUrl.length > 2048) {
      Alert.alert('Unsupported link', 'For safety, save an HTTPS link without embedded login details.');
      return;
    }
    const book: NcertBookLink = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle.slice(0, 120), className: className.trim().slice(0, 40), subject: subject.trim().slice(0, 60),
      language, chapter: chapter.trim().slice(0, 100), url: parsed.toString(), lastReadPage: 1, bookmarkedPages: [], addedAt: new Date().toISOString(),
    };
    addBook(book);
    setTitle(''); setClassName(''); setSubject(''); setChapter(''); setUrl(''); setFormOpen(false);
  };

  const remove = (book: NcertBookLink) => Alert.alert('Remove this book link?', `“${book.title}” will be removed from this device.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteBook(book.id) },
  ]);

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>Your library</Text></Pressable>
    <View style={styles.top}><Eyebrow>BOOKS & NOTES</Eyebrow><Text style={uiStyles.heading}>NCERT books</Text><Text style={uiStyles.body}>Save the official book links you provide. No NCERT URLs are preloaded here.</Text></View>
    <Card style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color={colors.purple} /><Text style={styles.noticeText}>Links stay on this device. Check each source yourself before marking it verified; this app has no book administrator or shared catalog.</Text></Card>
    <ActionButton title={formOpen ? 'Close book form' : 'Add NCERT book link'} onPress={() => setFormOpen((open) => !open)} secondary icon={<Ionicons name={formOpen ? 'close' : 'add-circle-outline'} size={18} color={colors.purple} />} />
    {formOpen ? <Card style={styles.form}>
      <Text style={styles.formHeading}>Add a book you want to read</Text>
      <TextInput accessibilityLabel="Book title" value={title} onChangeText={setTitle} placeholder="Book title" placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />
      <View style={styles.row}><TextInput accessibilityLabel="Class" value={className} onChangeText={setClassName} placeholder="Class (e.g. Class 8)" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} maxLength={40} /><TextInput accessibilityLabel="Subject" value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} maxLength={60} /></View>
      <TextInput accessibilityLabel="Chapter" value={chapter} onChangeText={setChapter} placeholder="Chapter (optional)" placeholderTextColor={colors.muted} style={styles.input} maxLength={100} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Language ${language}. Tap to change`} onPress={() => setLanguage((value) => value === 'English' ? 'Hindi' : value === 'Hindi' ? 'Other' : 'English')} style={styles.language}><Ionicons name="language-outline" size={17} color={colors.purple} /><Text style={styles.languageText}>Language: {language} · tap to change</Text></Pressable>
      <TextInput accessibilityLabel="Official book URL" value={url} onChangeText={setUrl} placeholder="https://… official book or chapter link" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" keyboardType="url" maxLength={2048} />
      <Text style={styles.formHint}>New links start unverified. The reader opens the original source; confirm the full book loads before publishing it as available on this device.</Text>
      <ActionButton title="Save link" onPress={save} icon={<Ionicons name="bookmark-outline" size={17} color="#FFFFFF" />} />
    </Card> : null}
    <SectionTitle accessory={<Text style={styles.count}>{books.length} saved</Text>}>Your NCERT links</SectionTitle>
    {!books.length ? <Card style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="library-outline" size={22} color={colors.purple} /></View><Text style={styles.emptyTitle}>No book links yet</Text><Text style={styles.emptyText}>Add a URL from the official NCERT source. This app will not guess or substitute any URLs.</Text></Card> : books.map((book) => <Card key={book.id} style={styles.bookCard}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/ncert/[id]', params: { id: book.id } })} style={({ pressed }) => [styles.bookRow, pressed && styles.pressed]}>
        <View style={styles.bookIcon}><Ionicons name="document-text-outline" size={19} color={colors.purple} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={styles.bookTitle}>{book.title}</Text><Text style={styles.bookMeta}>{book.className} · {book.subject} · {book.language}{book.chapter ? ` · ${book.chapter}` : ''}</Text><Text style={[styles.status, book.verifiedAt ? styles.verified : styles.unverified]}>{book.verifiedAt ? 'Verified by you' : 'Needs source check'}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${book.title}`} onPress={() => remove(book)} style={styles.remove}><Ionicons name="trash-outline" size={15} color={colors.danger} /><Text style={styles.removeText}>Remove link</Text></Pressable>
    </Card>)}
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, top: { gap: 6 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, backgroundColor: colors.softMint }, noticeText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  form: { padding: 16, gap: 11 }, formHeading: { color: colors.ink, fontSize: 15, fontWeight: '900' }, input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 12 }, row: { flexDirection: 'row', gap: 8 }, half: { flex: 1 }, language: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.softPurple, alignSelf: 'flex-start' }, languageText: { color: colors.purple, fontSize: 11, fontWeight: '800' }, formHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700' }, empty: { alignItems: 'center', gap: 10, padding: 21 }, emptyIcon: { width: 49, height: 49, borderRadius: 17, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  bookCard: { padding: 12, gap: 8 }, bookRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 10 }, bookIcon: { width: 41, height: 41, borderRadius: 14, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' }, bookTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, bookMeta: { color: colors.muted, fontSize: 10, lineHeight: 15 }, status: { fontSize: 9, fontWeight: '900' }, verified: { color: colors.success }, unverified: { color: colors.amber }, remove: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, borderTopWidth: 1, borderTopColor: colors.border }, removeText: { color: colors.danger, fontSize: 10, fontWeight: '800' }, pressed: { opacity: 0.83 },
});
