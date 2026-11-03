import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Chip, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityAvatar, CommunityImagePicker, relativeCommunityTime, type PickedCommunityImage } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { blockCommunityUser, getCommunityProfile, toggleCommunityFollow, updateCommunityProfile, uploadCommunityImage, type CommunityProfile } from '@/services/api';
import { useAuth } from '@/state/auth';

type Contribution = { id: string; title?: string; subject?: string; questionId?: string; body?: string; createdAt: string };

export default function CommunityProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [questions, setQuestions] = useState<Contribution[]>([]);
  const [answers, setAnswers] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [academicLevel, setAcademicLevel] = useState('');
  const [subjectsText, setSubjectsText] = useState('');
  const [showCountry, setShowCountry] = useState(false);
  const [showAcademicLevel, setShowAcademicLevel] = useState(false);
  const [showBio, setShowBio] = useState(false);
  const [showSubjects, setShowSubjects] = useState(false);
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(null);
  const [avatarPicked, setAvatarPicked] = useState<PickedCommunityImage | null>(null);
  const avatarUploadId = useRef('');
  const isSelf = user?.id === profileId;

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true); setError('');
    try {
      const data = await getCommunityProfile(profileId);
      setProfile(data.profile); setQuestions(data.questions); setAnswers(data.answers);
      setName(data.profile.name); setBio(data.profile.bio); setCountry(data.profile.country); setAcademicLevel(data.profile.academicLevel);
      setSubjectsText(data.profile.subjects.join(', ')); setShowCountry(data.profile.showCountry); setShowAcademicLevel(data.profile.showAcademicLevel);
      setShowBio(data.profile.showBio); setShowSubjects(data.profile.showSubjects); setAvatarMediaId(data.profile.avatar?.id ?? null); setAvatarPicked(null); avatarUploadId.current = '';
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this profile.'); }
    finally { setLoading(false); }
  }, [profileId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const subjectChips = useMemo(() => profile?.subjects ?? [], [profile?.subjects]);
  const save = async () => {
    if (!profile) return;
    if (name.trim().length < 2) { Alert.alert('Display name needed', 'Use at least two characters.'); return; }
    setSaving(true);
    try {
      let nextAvatarId = avatarMediaId;
      if (avatarPicked) {
        if (!avatarUploadId.current) avatarUploadId.current = (await uploadCommunityImage({ base64: avatarPicked.base64, mimeType: avatarPicked.mimeType })).image.id;
        nextAvatarId = avatarUploadId.current;
      }
      await updateCommunityProfile({ name: name.trim(), bio: bio.trim(), country: country.trim(), academicLevel, subjects: subjectsText.split(',').map((value) => value.trim()).filter(Boolean), avatarMediaId: nextAvatarId, showBio, showSubjects, showCountry, showAcademicLevel });
      setEditing(false); await load();
    } catch (cause) { Alert.alert('Profile not saved', cause instanceof Error ? cause.message : 'Try again.'); }
    finally { setSaving(false); }
  };
  const follow = async () => {
    if (!profile) return;
    try { const result = await toggleCommunityFollow(profile.id, !profile.following); setProfile((current) => current ? { ...current, following: result.following } : current); }
    catch (cause) { Alert.alert('Could not update follow', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const block = () => {
    if (!profile) return;
    Alert.alert('Block this student?', 'You will no longer see each other’s community questions or profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block student', style: 'destructive', onPress: () => void blockCommunityUser(profile.id).then(() => router.replace('/(tabs)/community')).catch((cause) => Alert.alert('Could not block student', cause instanceof Error ? cause.message : 'Try again.')) },
    ]);
  };

  if (loading && !profile) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Back</Text></Pressable><View style={styles.state}><ActivityIndicator color={colors.purple} /><Text style={styles.body}>Loading profile…</Text></View></AppScreen>;
  if (error || !profile) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Back</Text></Pressable><View style={styles.card}><Text style={styles.title}>Profile unavailable</Text><Text style={styles.body}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.link}>Try again</Text></Pressable></View></AppScreen>;

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Community</Text></Pressable>
    <View style={styles.profileCard}>
      <View style={styles.profileTop}><CommunityAvatar name={profile.name} size={68} imageUri={avatarPicked?.uri ?? (avatarMediaId ? profile.avatar?.url : null)} /><View style={styles.levelBadge}><Ionicons name="school-outline" size={14} color={colors.purpleDark} /><Text style={styles.levelText}>{profile.level}</Text></View></View>
      <Text style={styles.title}>{profile.name}</Text>
      <Text style={styles.points}>{profile.reputation} community points · participation level, not verified qualifications</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {profile.country ? <Text style={styles.meta}><Ionicons name="location-outline" size={14} color={colors.muted} /> {profile.country}</Text> : null}
      {profile.academicLevel ? <Text style={styles.meta}><Ionicons name="book-outline" size={14} color={colors.muted} /> {profile.academicLevel}</Text> : null}
      {subjectChips.length ? <View style={styles.subjectList}>{subjectChips.map((item) => <Chip key={item}>{item}</Chip>)}</View> : null}
      {!isSelf ? <View style={styles.profileActions}><ActionButton title={profile.following ? 'Following' : 'Follow student'} secondary={profile.following} onPress={() => void follow()} icon={<Ionicons name={profile.following ? 'checkmark' : 'person-add-outline'} size={16} color={profile.following ? colors.purpleDark : '#FFFFFF'} />} /><Pressable accessibilityRole="button" onPress={block} style={styles.blockButton}><Ionicons name="ban-outline" size={17} color={colors.danger} /><Text style={styles.blockText}>Block</Text></Pressable></View> : <Pressable accessibilityRole="button" onPress={() => setEditing((current) => !current)} style={styles.editButton}><Ionicons name={editing ? 'close-outline' : 'create-outline'} size={16} color={colors.purpleDark} /><Text style={styles.editText}>{editing ? 'Cancel edits' : 'Edit profile'}</Text></Pressable>}
    </View>

    {editing && isSelf ? <View style={styles.card}>
      <Eyebrow>EDIT YOUR PROFILE</Eyebrow>
      <TextInput accessibilityLabel="Display name" value={name} onChangeText={setName} placeholder="Display name" maxLength={60} style={styles.input} />
      <TextInput accessibilityLabel="Biography" value={bio} onChangeText={setBio} placeholder="A short bio (optional)" maxLength={500} multiline style={[styles.input, styles.bioInput]} />
      <TextInput accessibilityLabel="Country or region" value={country} onChangeText={setCountry} placeholder="Country or region (optional)" maxLength={80} style={styles.input} />
      <TextInput accessibilityLabel="Academic level" value={academicLevel} onChangeText={setAcademicLevel} placeholder="Academic level (optional)" maxLength={60} style={styles.input} />
      <TextInput accessibilityLabel="Subjects of interest" value={subjectsText} onChangeText={setSubjectsText} placeholder="Subjects, separated by commas" maxLength={500} style={styles.input} />
      <Text style={styles.privacyTitle}>Profile picture</Text>
      <CommunityImagePicker images={avatarPicked ? [avatarPicked] : []} disabled={saving} onChange={(next) => { setAvatarPicked(next[0] ?? null); if (next.length) { avatarUploadId.current = ''; setAvatarMediaId(null); } }} />
      {avatarMediaId || avatarPicked ? <Pressable accessibilityRole="button" onPress={() => { setAvatarMediaId(null); setAvatarPicked(null); avatarUploadId.current = ''; }}><Text style={styles.removeAvatar}>Remove profile picture</Text></Pressable> : null}
      <View style={styles.privacyRow}><View style={{ flex: 1, gap: 2 }}><Text style={styles.privacyTitle}>Show biography</Text><Text style={styles.body}>Hidden from other students unless enabled.</Text></View><Switch value={showBio} onValueChange={setShowBio} trackColor={{ true: colors.purple }} /></View>
      <View style={styles.privacyRow}><View style={{ flex: 1, gap: 2 }}><Text style={styles.privacyTitle}>Show subjects of interest</Text><Text style={styles.body}>Choose whether others can see your subjects.</Text></View><Switch value={showSubjects} onValueChange={setShowSubjects} trackColor={{ true: colors.purple }} /></View>
      <View style={styles.privacyRow}><View style={{ flex: 1, gap: 2 }}><Text style={styles.privacyTitle}>Show country or region</Text><Text style={styles.body}>Your location is optional and private by default.</Text></View><Switch value={showCountry} onValueChange={setShowCountry} trackColor={{ true: colors.purple }} /></View>
      <View style={styles.privacyRow}><View style={{ flex: 1, gap: 2 }}><Text style={styles.privacyTitle}>Show academic level</Text><Text style={styles.body}>Choose whether other students can see it.</Text></View><Switch value={showAcademicLevel} onValueChange={setShowAcademicLevel} trackColor={{ true: colors.purple }} /></View>
      <ActionButton title={saving ? 'Saving…' : 'Save profile'} disabled={saving} onPress={() => void save()} icon={saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={17} color="#FFFFFF" />} />
    </View> : null}

    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statNumber}>{profile.questionCount}</Text><Text style={styles.statLabel}>Questions</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{profile.answerCount}</Text><Text style={styles.statLabel}>Answers</Text></View>
      <View style={styles.stat}><Text style={styles.statNumber}>{profile.acceptedCount}</Text><Text style={styles.statLabel}>Accepted</Text></View>
    </View>

    <View style={styles.contributions}><Text style={styles.section}>Recent questions</Text>{questions.length ? questions.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })} style={styles.contribution}><View style={styles.contributionIcon}><Ionicons name="help-circle-outline" size={17} color={colors.purple} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.contributionTitle}>{item.title}</Text><Text style={styles.meta}>{item.subject} · {relativeCommunityTime(item.createdAt)}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>) : <Text style={styles.body}>No questions yet.</Text>}</View>
    <View style={styles.contributions}><Text style={styles.section}>Recent answers</Text>{answers.length ? answers.map((item) => <Pressable key={item.id} onPress={() => item.questionId && router.push({ pathname: '/community/[id]', params: { id: item.questionId } })} style={styles.contribution}><View style={styles.contributionIcon}><Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.purple} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.contributionTitle} numberOfLines={2}>{item.body}</Text><Text style={styles.meta}>{relativeCommunityTime(item.createdAt)}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>) : <Text style={styles.body}>No answers yet.</Text>}</View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, state: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 9 },
  profileCard: { alignItems: 'center', gap: 9, padding: 20, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, profileTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.softMint }, levelText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }, points: { color: colors.purpleDark, textAlign: 'center', fontSize: 10, lineHeight: 15, fontWeight: '700' }, bio: { color: colors.ink, textAlign: 'center', fontSize: 12, lineHeight: 19 }, meta: { color: colors.muted, fontSize: 10, lineHeight: 16 }, body: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  subjectList: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }, profileActions: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 }, blockButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4' }, blockText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  editButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.softMint }, editText: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  card: { gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', color: colors.ink, fontSize: 12 }, bioInput: { minHeight: 82, paddingTop: 11, textAlignVertical: 'top' }, privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }, privacyTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' }, removeAvatar: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 9 }, stat: { flex: 1, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface }, statNumber: { color: colors.ink, fontSize: 20, fontWeight: '800' }, statLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  contributions: { gap: 10 }, section: { color: colors.ink, fontSize: 16, fontWeight: '800' }, contribution: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, contributionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.softMint }, contributionTitle: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '700' }, link: { color: colors.purpleDark, fontSize: 12, fontWeight: '800' },
});
