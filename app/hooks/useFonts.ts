import { useFonts as useExpoFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Lora_400Regular,
  Lora_600SemiBold,
  Lora_400Regular_Italic,
} from '@expo-google-fonts/lora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

export function usePulseFonts() {
  const [loaded, error] = useExpoFonts({
    Lora_400Regular,
    Lora_600SemiBold,
    Lora_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    // Preload the Ionicons glyph font so tab-bar icons render on web
    ...Ionicons.font,
  });

  if (error) {
    console.error('[Fonts] Failed to load:', error);
  }

  return { loaded, error };
}
