export async function openPaymentApp(url: string): Promise<void> {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  // Browsers may return null with noopener even when the new tab opens.
  if (opened) opened.opener = null;
}
