import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blobDataUrl } from '@/shared/files/private-file-model';
import { useResource } from '@/shared/hooks/use-resource';
import { colors, fonts, radii } from '@/shared/theme/tokens';
import type { useTrip } from '../hooks/use-trip';

type Props = {
  api: ReturnType<typeof useTrip>['api'];
  tripId: string;
  dressCodeId: string;
  label: string;
  /** `cover`: the photo heading a dress code card; `thumb`: a small preview in the editor. */
  variant?: 'cover' | 'thumb';
};

/**
 * A private reference photo, loaded once and shown inline; tapping it opens a full-screen
 * viewer. Images are capped at 2 MB, so loading them with the card is acceptable.
 */
export function DressReferenceImage({ api, tripId, dressCodeId, label, variant = 'cover' }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const blob = await api.trips.dressCodeImage(tripId, dressCodeId, signal);
    if (blob.type !== 'image/jpeg' || blob.size < 1 || blob.size > 2 * 1024 * 1024) throw Error('Ảnh tham khảo không hợp lệ.');
    return blobDataUrl(blob);
  }, [api, tripId, dressCodeId]));
  const frame = variant === 'cover' ? styles.cover : styles.thumb;
  if (!resource.data) {
    return <View style={[frame, styles.placeholder]}>
      {resource.error
        ? <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`Tải lại ảnh tham khảo ${label}`} onPress={() => { void resource.reload(); }} style={styles.retry}>
          <Text style={styles.retryText}>{variant === 'cover' ? 'Chưa tải được ảnh · Thử lại' : 'Thử lại'}</Text>
        </Pressable>
        : <ActivityIndicator color={colors.teal} />}
    </View>;
  }
  return <>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`Xem ảnh tham khảo ${label}`} onPress={() => setZoomed(true)}
      style={({ pressed }) => [frame, pressed && { opacity: 0.85 }]}>
      <Image source={{ uri: resource.data }} contentFit="cover" cachePolicy="none" accessibilityLabel={`Ảnh tham khảo ${label}`} style={StyleSheet.absoluteFill} />
      {variant === 'cover' && <View style={styles.badge} pointerEvents="none"><Text style={styles.badgeText}>⤢ Ảnh tham khảo</Text></View>}
    </Pressable>
    <ImageViewer visible={zoomed} uri={resource.data} label={label} onClose={() => setZoomed(false)} />
  </>;
}

/** Full-screen, letterboxed view of one photo. */
export function ImageViewer({ visible, uri, label, onClose }: { visible: boolean; uri: string; label: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.viewer}>
      {/* Tapping anywhere outside the photo also closes; the ✕ is the labelled control. */}
      <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <Image source={{ uri }} contentFit="contain" cachePolicy="none" accessibilityLabel={`${label}, ảnh phóng to`} style={styles.full} pointerEvents="none" />
      <View style={[styles.viewerBar, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <Text numberOfLines={1} style={styles.viewerTitle}>{label}</Text>
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Đóng ảnh" onPress={onClose} hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 16 / 9, maxHeight: 240, overflow: 'hidden', backgroundColor: colors.fill },
  thumb: { width: 88, height: 88, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.fill },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  retry: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surface },
  retryText: { color: colors.teal, fontSize: 12, fontFamily: fonts.bold },
  badge: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: 'rgba(11,42,69,0.62)' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bold },
  viewer: { flex: 1, backgroundColor: 'rgba(8,18,32,0.97)', justifyContent: 'center' },
  full: { width: '100%', height: '80%' },
  viewerBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  viewerTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  closeText: { color: '#FFFFFF', fontSize: 18, fontFamily: fonts.bold },
});
