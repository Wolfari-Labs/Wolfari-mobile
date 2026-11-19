import { openURL } from 'expo-linking';

export async function openPaymentApp(url: string): Promise<void> {
  await openURL(url);
}
