import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { blobDataUrl } from '@/shared/files/private-file-model';
import { useResource } from '@/shared/hooks/use-resource';
import { Button } from '@/shared/ui/button';
import { ResourceFeedback } from '@/shared/ui/journal';
import type { useTrip } from '../hooks/use-trip';

export function DressReferenceImage({ api, tripId, dressCodeId, label, initiallyOpen = false }: {
  api: ReturnType<typeof useTrip>['api']; tripId: string; dressCodeId: string; label: string; initiallyOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const blob = await api.trips.dressCodeImage(tripId, dressCodeId, signal);
    if (blob.type !== 'image/jpeg' || blob.size < 1 || blob.size > 2 * 1024 * 1024) throw Error('Ảnh tham khảo không hợp lệ.');
    return blobDataUrl(blob);
  }, [api, tripId, dressCodeId]), expanded);
  return <View style={{ gap: 10 }}>
    <Button label={expanded ? 'Ẩn ảnh tham khảo' : 'Xem ảnh tham khảo'} accessibilityLabel={`${expanded ? 'Ẩn' : 'Xem'} ảnh tham khảo ${label}`} compact variant="soft" onPress={() => setExpanded(value => !value)} />
    {expanded && <>
      <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
      {resource.data && <Image source={{ uri: resource.data }} contentFit="contain" cachePolicy="none" accessibilityLabel={`Ảnh tham khảo ${label}`} style={{ width: '100%', height: 240, borderRadius: 16 }} />}
    </>}
  </View>;
}
