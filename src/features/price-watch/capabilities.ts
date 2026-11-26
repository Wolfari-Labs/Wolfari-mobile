import { ApiError } from '../../shared/api/api-client.ts';
import { priceProviderLabel } from './labels.ts';

/** GET /price-watch-capabilities: the fare source new watches use and what it can compare. */
export type Capabilities = {
  provider: string;
  available: boolean;
  journey_types: ('ONE_WAY' | 'ROUND_TRIP')[];
  cabin_classes: string[];
  max_adults: number;
  max_children: number;
  max_infants: number;
  max_passengers: number;
  currencies: string[];
};

/** Older servers have no capabilities API: offer everything and let the server decide. */
export const ANY_SOURCE: Capabilities = {
  provider: '',
  available: true,
  journey_types: ['ONE_WAY', 'ROUND_TRIP'],
  cabin_classes: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
  max_adults: 9,
  max_children: 9,
  max_infants: 9,
  max_passengers: 9,
  currencies: ['VND'],
};

const JOURNEYS = ['ONE_WAY', 'ROUND_TRIP'];
const CABINS = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
const count = (value: unknown) => {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 9)
    throw new ApiError('INVALID_RESPONSE', 'Thông tin nguồn giá không hợp lệ.');
  return Number(value);
};
const list = (value: unknown, allowed: string[]) => {
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(String(item))))
    throw new ApiError('INVALID_RESPONSE', 'Thông tin nguồn giá không hợp lệ.');
  return value.map(String);
};

export function decodeCapabilities(value: unknown): Capabilities {
  const row = (value ?? {}) as Record<string, unknown>;
  if (typeof row.provider !== 'string' || typeof row.available !== 'boolean')
    throw new ApiError('INVALID_RESPONSE', 'Thông tin nguồn giá không hợp lệ.');
  const journeys = list(row.journey_types, JOURNEYS) as Capabilities['journey_types'];
  const cabins = list(row.cabin_classes, CABINS);
  // A source that compares nothing cannot be offered at all.
  if (!journeys.length || !cabins.length || count(row.max_adults) < 1)
    throw new ApiError('INVALID_RESPONSE', 'Thông tin nguồn giá không hợp lệ.');
  return {
    provider: row.provider,
    available: row.available,
    journey_types: journeys,
    cabin_classes: cabins,
    max_adults: count(row.max_adults),
    max_children: count(row.max_children),
    max_infants: count(row.max_infants),
    max_passengers: Math.max(1, count(row.max_passengers)),
    currencies: list(row.currencies, ['VND']),
  };
}

/** One line under the form title: which source and what it compares. */
export function capabilitiesNote(capabilities: Capabilities): string {
  const source = capabilities.provider ? priceProviderLabel(capabilities.provider) : 'Nguồn giá của máy chủ';
  const parts = [
    capabilities.journey_types.length === 1
      ? capabilities.journey_types[0] === 'ONE_WAY'
        ? 'vé một chiều'
        : 'vé khứ hồi'
      : 'một chiều hoặc khứ hồi',
    capabilities.cabin_classes.length === 1 && capabilities.cabin_classes[0] === 'ECONOMY'
      ? 'hạng phổ thông'
      : 'mọi hạng ghế',
    capabilities.max_passengers === 1 ? '1 người lớn' : `tối đa ${capabilities.max_passengers} hành khách`,
  ];
  return `${source} so sánh ${parts.join(', ')}.`;
}

/** Explains a combination the source cannot compare before the server answers 400. */
export function unsupportedReason(
  capabilities: Capabilities,
  input: { journey_type: string; cabin_class: string | null; passengers: { adults: number; children: number; infants: number } },
): string | undefined {
  const { adults, children, infants } = input.passengers;
  if (
    !capabilities.journey_types.includes(input.journey_type as 'ONE_WAY') ||
    !capabilities.cabin_classes.includes(input.cabin_class ?? 'ECONOMY') ||
    adults > capabilities.max_adults ||
    children > capabilities.max_children ||
    infants > capabilities.max_infants ||
    adults + children + infants > capabilities.max_passengers
  )
    return `Nguồn giá hiện tại không so sánh được lựa chọn này. ${capabilitiesNote(capabilities)}`;
  return undefined;
}
