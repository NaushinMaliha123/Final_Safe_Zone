import { Linking, NativeModules, Platform } from 'react-native';

const { DirectCallModule } = NativeModules as any;

export default function DirectCallRoute() {
  return null;
}

export async function callNumber(phone: string) {
  if (!phone) throw new Error('No phone number provided');

  if (Platform.OS === 'android') {
    // If a native module exists, prefer it (it performs ACTION_CALL)
    if (DirectCallModule && typeof DirectCallModule.callNumber === 'function') {
      return DirectCallModule.callNumber(phone);
    }
    // Fallback to opening the dialer
    return Linking.openURL(`tel:${phone}`);
  }

  // iOS: open dialer (cannot direct-call)
  return Linking.openURL(`telprompt:${phone}`);
}
