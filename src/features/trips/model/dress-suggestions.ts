/**
 * Built-in dress code suggestions: a fixed table of Vietnamese climate by region and month,
 * plus presets for common kinds of places. No weather provider and no network call; the
 * editor picks a suggestion, can edit it, and saves it as an ordinary dress code.
 * Keep this file identical in Web and mobile.
 */
export type DressWeather = 'HOT' | 'RAINY' | 'COOL' | 'COLD';
export type DressRegion = 'NORTH' | 'CENTRAL' | 'SOUTH' | 'HIGHLAND';
export interface DressColor {
  readonly name: string;
  readonly hex: string;
}
export interface DressSuggestion {
  readonly id: string;
  readonly label: string;
  readonly colors: readonly DressColor[];
  readonly advice: string;
}

export const dressWeatherOptions: readonly { value: DressWeather; label: string }[] = [
  { value: 'HOT', label: 'Nắng nóng' },
  { value: 'RAINY', label: 'Mùa mưa' },
  { value: 'COOL', label: 'Se lạnh' },
  { value: 'COLD', label: 'Lạnh' },
];

const color = (name: string, hex: string): DressColor => ({ name, hex });
const white = color('trắng', '#FFFFFF'),
  beige = color('be', '#E8DCC4'),
  sky = color('xanh nhạt', '#BFE3F5'),
  sea = color('xanh biển', '#2E86C1'),
  navy = color('xanh navy', '#1F3A5F'),
  grey = color('xám', '#8A8F98'),
  brown = color('nâu', '#8B5E3C'),
  moss = color('xanh rêu', '#6B7F4E'),
  wine = color('đỏ đô', '#7B1E2B'),
  cream = color('kem', '#F5ECD7'),
  yellow = color('vàng', '#F2C230'),
  purple = color('tím', '#6F4BA3'),
  orange = color('cam', '#F28C28'),
  red = color('đỏ', '#D7263D'),
  black = color('đen', '#1C1C1E'),
  pastel = color('hồng pastel', '#F7C6D0'),
  denim = color('xanh denim', '#4F6D8F');

const weatherPresets: Record<DressWeather, DressSuggestion> = {
  HOT: {
    id: 'weather-hot',
    label: 'Mát mẻ ngày nắng',
    colors: [white, beige, sky],
    advice:
      'Vải lanh hoặc cotton mỏng, thấm mồ hôi. Mang mũ rộng vành, kính râm và kem chống nắng.',
  },
  RAINY: {
    id: 'weather-rainy',
    label: 'Gọn nhẹ ngày mưa',
    colors: [navy, grey, moss],
    advice:
      'Đồ nhanh khô, tông sẫm để không lộ vết nước. Mang áo mưa mỏng hoặc áo khoác gió, dép quai hậu hay giày chống nước; tránh vải trắng mỏng.',
  },
  COOL: {
    id: 'weather-cool',
    label: 'Se lạnh nhẹ nhàng',
    colors: [beige, brown, moss],
    advice: 'Áo dài tay, khoác thêm cardigan hoặc áo khoác mỏng. Quần dài và giày kín mũi.',
  },
  COLD: {
    id: 'weather-cold',
    label: 'Ấm áp ngày lạnh',
    colors: [wine, brown, cream],
    advice: 'Áo giữ nhiệt bên trong, áo len và áo phao bên ngoài. Thêm khăn, mũ len, tất dày.',
  },
};

/** Keywords are matched without diacritics, so "Hội An" and "hoi an" both hit. */
const placePresets: readonly (DressSuggestion & { readonly keywords: readonly string[] })[] = [
  {
    id: 'place-beach',
    label: 'Trắng – xanh biển',
    colors: [white, sea, beige],
    advice:
      'Đồ bơi, sơ mi lanh hoặc váy maxi khoác ngoài, dép dễ tháo. Mang thêm áo chống nắng và khăn tắm.',
    keywords: [
      'bien',
      'beach',
      'cu lao',
      'bai tam',
      'my khe',
      'nha trang',
      'phu quoc',
      'quy nhon',
      'vung tau',
      'con dao',
      'ly son',
      'mui ne',
      'da nang',
    ],
  },
  {
    id: 'place-sacred',
    label: 'Kín đáo, màu nhã',
    colors: [white, beige, brown],
    advice:
      'Áo có tay, quần hoặc váy dài qua gối. Giày dép dễ tháo khi vào chính điện; tránh đồ xuyên thấu và màu quá rực.',
    keywords: [
      'chua',
      'den tho',
      'dinh lang',
      'nha tho',
      'lang tam',
      'thanh dia',
      'linh ung',
      'pagoda',
      'temple',
      'church',
      'tam linh',
    ],
  },
  {
    id: 'place-old-town',
    label: 'Vàng – trắng phố cổ',
    colors: [yellow, white, beige],
    advice:
      'Áo dài, váy hoa nhí hoặc đồ lanh sáng màu, nổi bật trên nền tường vàng. Đi giày đế bằng để dạo bộ lâu.',
    keywords: ['pho co', 'hoi an', 'old town', 'old quarter'],
  },
  {
    id: 'place-hue',
    label: 'Áo dài cố đô',
    colors: [purple, white, yellow],
    advice: 'Áo dài tím Huế hoặc trắng, nón lá để chụp ảnh ở Đại Nội và lăng tẩm. Mang giày bệt.',
    keywords: ['hue', 'dai noi', 'co do', 'kinh thanh'],
  },
  {
    id: 'place-mountain',
    label: 'Năng động, màu nổi',
    colors: [orange, red, yellow],
    advice:
      'Màu nổi để dễ nhận ra nhau trên đường. Quần dài co giãn, giày đế bám, áo khoác gió và mũ.',
    keywords: [
      'nui',
      'trekking',
      'leo nui',
      'deo',
      'thac',
      'rung',
      'hang dong',
      'ba na',
      'fansipan',
      'son tra',
      'cam trai',
    ],
  },
  {
    id: 'place-highland',
    label: 'Vintage cao nguyên',
    colors: [beige, brown, wine],
    advice:
      'Áo len, áo khoác dạ hoặc cardigan, khăn choàng. Tông ấm hợp với đồi thông và vườn hoa.',
    keywords: ['da lat', 'sa pa', 'sapa', 'moc chau', 'tam dao', 'mang den', 'ha giang'],
  },
  {
    id: 'place-dinner',
    label: 'Lịch sự buổi tối',
    colors: [black, white, beige],
    advice: 'Sơ mi hoặc polo với quần dài, đầm suông hay váy midi. Giày kín mũi; không dép lê.',
    keywords: [
      'an toi',
      'tiec',
      'nha hang',
      'rooftop',
      'gala',
      'fine dining',
      'dinner',
      'bar',
      'tong ket',
    ],
  },
  {
    id: 'place-boat',
    label: 'Trắng – navy trên thuyền',
    colors: [white, navy, red],
    advice: 'Áo sọc ngang hoặc sơ mi trắng, quần short. Dép chống trượt và áo khoác gió mỏng.',
    keywords: ['thuyen', 'du thuyen', 'song han', 'vinh', 'kayak', 'cano', 'ha long', 'cruise'],
  },
  {
    id: 'place-city',
    label: 'Dạo phố thoải mái',
    colors: [pastel, denim, white],
    advice: 'Áo thun hoặc sơ mi với quần jean, giày thể thao êm chân. Túi đeo chéo gọn nhẹ.',
    keywords: [
      'thanh pho',
      'dao pho',
      'cafe',
      'ca phe',
      'cho dem',
      'bao tang',
      'tham quan',
      'pho di bo',
      'an sang',
      'city',
    ],
  },
];

const regionKeywords: readonly (readonly [DressRegion, readonly string[]])[] = [
  [
    'HIGHLAND',
    ['da lat', 'sa pa', 'sapa', 'moc chau', 'tam dao', 'bao loc', 'mang den', 'ha giang'],
  ],
  ['NORTH', ['ha noi', 'ha long', 'ninh binh', 'hai phong', 'cat ba', 'quang ninh', 'mai chau']],
  [
    'CENTRAL',
    ['da nang', 'hoi an', 'hue', 'nha trang', 'quy nhon', 'phu yen', 'quang binh', 'ly son'],
  ],
  [
    'SOUTH',
    ['sai gon', 'ho chi minh', 'phu quoc', 'can tho', 'vung tau', 'con dao', 'mien tay', 'mui ne'],
  ],
];

/** Lower case, no diacritics, single spaces, padded so keywords match whole words only. */
export function plainText(value: string): string {
  return ` ${value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

export function dressRegion(
  texts: readonly string[],
  latitude?: number | null,
): DressRegion | null {
  const haystack = plainText(texts.join(' '));
  for (const [region, keywords] of regionKeywords)
    if (keywords.some((keyword) => haystack.includes(` ${keyword} `))) return region;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
  return latitude >= 19.5 ? 'NORTH' : latitude >= 11.5 ? 'CENTRAL' : 'SOUTH';
}

/** Typical weather for a Vietnamese region in a calendar month (1–12). */
export function dressWeather(region: DressRegion | null, month: number): DressWeather {
  const during = (...months: number[]) => months.includes(month);
  if (region === 'NORTH') return during(12, 1, 2) ? 'COLD' : during(3, 4, 10, 11) ? 'COOL' : 'HOT';
  if (region === 'HIGHLAND') return during(11, 12, 1, 2) ? 'COLD' : 'COOL';
  if (region === 'CENTRAL') return during(9, 10, 11, 12) ? 'RAINY' : during(1, 2) ? 'COOL' : 'HOT';
  if (region === 'SOUTH') return during(5, 6, 7, 8, 9, 10, 11) ? 'RAINY' : 'HOT';
  return 'HOT';
}

/** The weather preset first, then every place preset whose keywords appear in the texts. */
export function dressSuggestions(
  weather: DressWeather,
  texts: readonly string[],
): DressSuggestion[] {
  const haystack = plainText(texts.join(' '));
  return [
    weatherPresets[weather],
    ...placePresets.filter((preset) =>
      preset.keywords.some((keyword) => haystack.includes(` ${keyword} `)),
    ),
  ].map(({ id, label, colors, advice }) => ({ id, label, colors, advice }));
}

/** Dress codes have no colour field, so the palette is written into the description. */
export function dressSuggestionText(suggestion: DressSuggestion): string {
  return `Tông màu: ${suggestion.colors.map((item) => item.name).join(', ')}. ${suggestion.advice}`;
}
