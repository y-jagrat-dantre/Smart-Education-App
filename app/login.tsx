import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppScreen, Card, Eyebrow } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { useAuth } from '@/state/auth';

export default function LoginScreen() {
  const { user, ready, signInWithPassword, createAccount } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && user) router.replace('/(tabs)'); }, [ready, user]);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await createAccount(name, email, password);
      else await signInWithPassword(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not connect. Check your backend and try again.');
    } finally { setBusy(false); }
  };

  return <AppScreen style={styles.screen}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
      <View style={styles.brand}><View style={styles.logo}><Ionicons name="pulse" size={24} color={colors.lime} /></View><View><Text style={styles.brandName}>SAMAJVED</Text><Text style={styles.brandTag}>STUDY BETTER, TOGETHER</Text></View></View>
      <View style={styles.intro}><Eyebrow color={colors.purpleDark}>YOUR STUDY SPACE</Eyebrow><Text style={styles.heading}>{mode === 'login' ? 'Welcome back.' : 'Make room to learn.'}</Text><Text style={styles.body}>{mode === 'login' ? 'Sign in to pick up your notebooks and study with classmates.' : 'Create an account to join shared study boards with your classmates.'}</Text></View>

      <View style={styles.featureRow}><View style={styles.feature}><Ionicons name="musical-notes-outline" size={15} color={colors.purpleDark} /><Text style={styles.featureText}>Study songs</Text></View><View style={styles.feature}><Ionicons name="layers-outline" size={15} color={colors.purpleDark} /><Text style={styles.featureText}>Learning tools</Text></View><View style={styles.feature}><Ionicons name="people-outline" size={15} color={colors.purpleDark} /><Text style={styles.featureText}>Shared boards</Text></View></View>

      <Card style={styles.form}>
        {mode === 'register' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Maya Patel" icon="person-outline" autoCapitalize="words" autoComplete="name" textContentType="name" /> : null}
        <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} icon="lock-closed-outline" secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'current-password'} textContentType={mode === 'register' ? 'newPassword' : 'password'} />
        {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !ready, busy }} disabled={busy || !ready} onPress={() => void submit()} style={({ pressed }) => [styles.submit, (busy || !ready) && styles.disabled, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.submitText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>}
          {!busy ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
        </Pressable>
      </Card>

      <View style={styles.switchRow}><Text style={styles.switchLabel}>{mode === 'login' ? 'New to SAMAJVED?' : 'Already have an account?'}</Text><Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}><Text style={styles.switchAction}>{mode === 'login' ? 'Create account' : 'Sign in'}</Text></Pressable></View>
      <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={16} color={colors.success} /><Text style={styles.securityText}>Passwords are stored as secure hashes on your XAMPP MySQL database.</Text></View>
    </KeyboardAvoidingView>
  </AppScreen>;
}

function Field({ label, icon, ...props }: { label: string; icon: keyof typeof Ionicons.glyphMap } & ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><Ionicons name={icon} size={18} color={colors.muted} /><TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} returnKeyType="done" /></View></View>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', paddingTop: 16, paddingBottom: 32 },
  content: { flex: 1, justifyContent: 'center', gap: 22, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  logo: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.midnight },
  brandName: { color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  brandTag: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.25, marginTop: 4 },
  intro: { gap: 8 },
  heading: { color: colors.ink, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, fontWeight: '800' },
  body: { maxWidth: 360, color: colors.muted, fontSize: 14, lineHeight: 21 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feature: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.softPurple },
  featureText: { color: colors.purpleDark, fontSize: 10, fontWeight: '700' },
  form: { gap: 15, padding: 18, borderRadius: 22 },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, color: colors.ink, fontSize: 14, minWidth: 0, outlineStyle: 'none' as never },
  submit: { minHeight: 54, marginTop: 2, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, borderRadius: 17, backgroundColor: colors.purple },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.86 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  switchRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  switchLabel: { color: colors.muted, fontSize: 12 },
  switchAction: { color: colors.purple, fontSize: 12, fontWeight: '900' },
  security: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.softMint },
  securityText: { flex: 1, color: colors.purpleDark, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
