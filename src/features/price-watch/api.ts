import { ApiError, type ApiClient } from '../../shared/api/api-client.ts';
import { decodeRow, object, pageQuery, validateMoney } from '../finance/api.ts';
import { money, type Page } from '../finance/extended-model.ts';
import { calendarLabel, dateKey, localTimestamp, parseDate, timeLabel } from '../trips/utils.ts';
export type WatchInput = {
  provider: 'MOCK_FLIGHT';
  origin: string;
  destination: string;
  departure_date: string;
  departure_at: string;
  return_date: string | null;
  journey_type: 'ONE_WAY' | 'ROUND_TRIP';
  passengers: { adults: number; children: number; infants: number };
  cabin_class: string | null;
  currency: 'VND';
  threshold_price: string;
};
export type Watch = {
  id: string;
  trip_id: string;
  user_id: string;
  query_group_id: string;
  threshold_price: string;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'STOPPED';
  status_reason: string | null;
  version: number;
  expires_at: string;
  last_alert_price: string | null;
  last_alert_at: string | null;
  normalized_query: Omit<WatchInput, 'threshold_price'> & { transport_type: 'FLIGHT' };
};
export type Observation = {
  id: string;
  price: string;
  currency: 'VND';
  provider: string;
  observed_at: string;
  fetched_at: string;
};
export type Observations = Page<Observation> & { stale: boolean; last_error: string | null };
/** Airports offered as one-tap chips; any other 3-letter IATA code can still be typed. */
export const QUICK_AIRPORTS = ['SGN', 'HAN', 'DAD', 'CXR', 'PQC', 'HPH'] as const;
export const WATCH_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * The form asks for the departure in Vietnam time (DD/MM/YYYY + HH:mm). The API stores a UTC
 * instant whose UTC calendar day must equal `departure_date`, so both are derived here.
 */
export function localWatchValues(
  values: Record<string, string>,
  timezone = WATCH_TIMEZONE,
): Record<string, string> {
  const day = parseDate(values.departure_date ?? '');
  const at = day && localTimestamp(day, values.departure_time || '12:00', timezone);
  if (!at) throw Error('Chọn ngày và giờ khởi hành hợp lệ (giờ Việt Nam).');
  const round = values.journey_type === 'ROUND_TRIP';
  const back = round ? parseDate(values.return_date ?? '') : '';
  if (round && !back) throw Error('Chọn ngày về hợp lệ cho chuyến khứ hồi.');
  return {
    ...values,
    departure_date: at.slice(0, 10),
    departure_time: at.slice(11, 16),
    return_date: back ?? '',
  };
}

/** Inverse of localWatchValues for the edit form. */
export function watchFormDates(watch: Watch | undefined, timezone = WATCH_TIMEZONE) {
  const q = watch?.normalized_query;
  if (!q) return { departure_date: '', departure_time: '12:00', return_date: '' };
  return {
    departure_date: calendarLabel(dateKey(q.departure_at, timezone)),
    departure_time: timeLabel(q.departure_at, timezone),
    return_date: q.return_date ? calendarLabel(q.return_date) : '',
  };
}

export function watchInput(values: Record<string, string>, now = Date.now()): WatchInput {
  const date = values.departure_date;
  const at = `${date}T${values.departure_time || '12:00'}:00Z`;
  const validDate = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (
    !validDate(date) ||
    !/^\d{2}:\d{2}$/.test(values.departure_time || '12:00') ||
    !Number.isFinite(Date.parse(at)) ||
    new Date(at).toISOString().slice(0, 10) !== date ||
    Date.parse(at) <= now
  )
    throw Error('Ngày/giờ khởi hành phải hợp lệ và ở tương lai.');
  const origin = values.origin.trim().toUpperCase(),
    destination = values.destination.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination)
    throw Error('Nhập hai mã sân bay IATA khác nhau, mỗi mã 3 chữ cái.');
  const adults = Number(values.adults),
    children = Number(values.children),
    infants = Number(values.infants);
  if (
    ![values.adults, values.children, values.infants].every((v) => /^\d$/.test(v)) ||
    adults < 1 ||
    infants > adults ||
    adults + children + infants > 9
  )
    throw Error('Tối đa 9 hành khách, ít nhất 1 người lớn; số em bé không vượt số người lớn.');
  const round = values.journey_type === 'ROUND_TRIP';
  if (round && (!validDate(values.return_date) || values.return_date < date))
    throw Error('Ngày về phải hợp lệ và không trước ngày đi.');
  return {
    provider: 'MOCK_FLIGHT',
    origin,
    destination,
    departure_date: date,
    departure_at: at,
    return_date: round ? values.return_date : null,
    journey_type: round ? 'ROUND_TRIP' : 'ONE_WAY',
    passengers: { adults, children, infants },
    cabin_class: values.cabin_class || null,
    currency: 'VND',
    threshold_price: money(values.threshold_price),
  };
}
export function createPriceWatchApi(client: ApiClient) {
  const enc = encodeURIComponent;
  return {
    async list(tripId: string, cursor?: string | null, signal?: AbortSignal): Promise<Page<Watch>> {
      const { data, meta } = await client.requestWithMeta<unknown, { next_cursor: string | null }>(
        `/trips/${enc(tripId)}/price-watches?${pageQuery(cursor)}`,
        { signal },
      );
      if (
        !Array.isArray(data) ||
        (meta.next_cursor !== null && typeof meta.next_cursor !== 'string')
      )
        throw new ApiError('INVALID_RESPONSE', 'Danh sách theo dõi không hợp lệ.');
      return {
        items: data.map((item) => {
          const w = decodeRow<Watch>(item, { field: 'trip_id', id: tripId });
          object(w.normalized_query);
          validateMoney(w.threshold_price);
          if (!['ACTIVE', 'PAUSED', 'EXPIRED', 'STOPPED'].includes(w.status))
            throw new ApiError('INVALID_RESPONSE', 'Trạng thái theo dõi không hợp lệ.');
          return w;
        }),
        next_cursor: meta.next_cursor,
      };
    },
    async observations(
      id: string,
      cursor?: string | null,
      signal?: AbortSignal,
    ): Promise<Observations> {
      const { data, meta } = await client.requestWithMeta<
        unknown,
        { next_cursor: string | null; stale: boolean; last_error: string | null }
      >(`/price-watches/${enc(id)}/observations?${pageQuery(cursor)}`, { signal });
      if (
        !Array.isArray(data) ||
        typeof meta.stale !== 'boolean' ||
        (meta.last_error !== null && typeof meta.last_error !== 'string') ||
        (meta.next_cursor !== null && typeof meta.next_cursor !== 'string')
      )
        throw new ApiError('INVALID_RESPONSE', 'Lịch sử giá không hợp lệ.');
      return {
        items: data.map((item) => {
          const r = decodeRow<Observation>(item);
          validateMoney(r.price);
          return r;
        }),
        ...meta,
      };
    },
  };
}
