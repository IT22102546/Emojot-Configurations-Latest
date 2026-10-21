// Import only the weights the app uses; the package root would bundle all 18.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { KioskScreen } from './src/components/KioskScreen';
import { LoadingScreen } from './src/components/LoadingScreen';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // If the fonts fail to load, carry on with the system font rather than block the kiosk.
  if (!fontsLoaded && !fontError) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <KioskScreen />
    </SafeAreaProvider>
  );
}

