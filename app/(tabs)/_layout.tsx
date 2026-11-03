import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Redirect } from 'expo-router';
import { useAuth } from '@/state/auth';
import { useAppStore } from '@/state/app-store';

const icons = {
  index: ['home-outline', 'home'],
  progress: ['stats-chart-outline', 'stats-chart'],
  explore: ['albums-outline', 'albums'],
  create: ['add', 'add'],
  community: ['chatbubbles-outline', 'chatbubbles'],
  library: ['library-outline', 'library'],
  profile: ['person-outline', 'person'],
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, ready } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const claimUnassignedSongs = useAppStore((state) => state.claimUnassignedSongs);
  useEffect(() => {
    if (user && hasHydrated) claimUnassignedSongs(user.id);
  }, [user?.id, hasHydrated, claimUnassignedSongs]);
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  return <Tabs screenOptions={({ route }) => {
    const pair = icons[route.name as keyof typeof icons] ?? icons.index;
    return {
      headerShown: false,
      tabBarActiveTintColor: colors.purpleDark,
      tabBarInactiveTintColor: '#77847E',
      tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginTop: 3, marginBottom: 1 },
      tabBarItemStyle: { paddingTop: 2 },
      tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: Math.max(10, insets.bottom + 5), height: 70, paddingTop: 8, paddingBottom: 7, paddingHorizontal: 7, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 23, shadowColor: colors.shadow, shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color as string} name={pair[focused ? 1 : 0]} create={route.name === 'create'} />,
    };
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home' }} />
    <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    <Tabs.Screen name="create" options={{ title: 'Create' }} />
    <Tabs.Screen name="explore" options={{ title: 'Studio' }} />
    <Tabs.Screen name="community" options={{ title: 'Community' }} />
    <Tabs.Screen name="library" options={{ title: 'Library' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
  </Tabs>;
}

function TabIcon({ focused, color, name, create }: { focused: boolean; color: string; name: string; create: boolean }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(progress, { toValue: focused ? 1 : 0, speed: 22, bounciness: 4, useNativeDriver: true }).start();
  }, [focused, progress]);

  if (create) return <Animated.View style={[styles.createWrap, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}><View style={styles.createButton}><Ionicons name={name as keyof typeof Ionicons.glyphMap} size={25} color="#FFFFFF" /></View></Animated.View>;
  return <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }] }}><Ionicons name={name as keyof typeof Ionicons.glyphMap} size={21} color={color} /></Animated.View>;
}

const styles = StyleSheet.create({
  createWrap: { height: 38, alignItems: 'center', justifyContent: 'flex-start', marginTop: -18 },
  createButton: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple, borderWidth: 4, borderColor: colors.surface, shadowColor: colors.purple, shadowOpacity: 0.21, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
});
