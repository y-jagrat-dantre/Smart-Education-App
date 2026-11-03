import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@/theme/colors';
import { useAuth } from '@/state/auth';

export default function IndexScreen() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><ActivityIndicator color={colors.purple} /></View>;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
