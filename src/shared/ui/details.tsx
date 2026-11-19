import { useState, type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, typography } from '../theme/tokens';

/** Secondary information expands inline. Blocking errors and decisions stay visible. */
export function Details({ title, children, defaultOpen = false }: PropsWithChildren<{ title: string; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  return <View style={{ gap: 8 }}>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} aria-expanded={open}
      onPress={() => setOpen(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[typography.footnote, { flex: 1, color: colors.muted }]}>{title}</Text>
      <Text style={[typography.footnote, { color: colors.muted }]}>{open ? '−' : '+'}</Text>
    </Pressable>
    {open && <View style={{ gap: 10 }}>{children}</View>}
  </View>;
}
