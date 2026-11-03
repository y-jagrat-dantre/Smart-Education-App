import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme/colors';

export function AppScreen({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const entrance = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, reduceMotion]));

  const entranceStyle = { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] };
  return <SafeAreaView edges={scroll ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']} style={styles.safe}>
    {scroll ? <Animated.ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, style]} style={entranceStyle}>{children}</Animated.ScrollView> : <Animated.View style={[styles.scroll, styles.fill, style, entranceStyle]}>{children}</Animated.View>}
  </SafeAreaView>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, accessory }: PropsWithChildren<{ accessory?: ReactNode }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{children}</Text>{accessory}</View>;
}

export function Eyebrow({ children, color = colors.muted }: PropsWithChildren<{ color?: string }>) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function ActionButton({ title, onPress, icon, secondary = false, disabled = false, style }: {
  title: string; onPress: () => void; icon?: ReactNode; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.pressed, style]}>
    {icon}<Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
  </Pressable>;
}

export function Chip({ children, selected, onPress }: PropsWithChildren<{ selected?: boolean; onPress?: () => void }>) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected: !!selected } : undefined} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{children}</Text></Pressable>;
}

export const uiStyles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  heading: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 156, gap: 20 },
  fill: { flex: 1 },
  card: { padding: 18, gap: 13, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 0.035, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 5 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.45 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.45 },
  button: { minHeight: 54, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: colors.purple, shadowColor: colors.purpleDark, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, shadowOpacity: 0, elevation: 0 },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  buttonTextSecondary: { color: colors.ink },
  pressed: { opacity: 0.84 },
  chip: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.softPurple, borderColor: colors.purple },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: colors.purpleDark, fontWeight: '800' },
});
