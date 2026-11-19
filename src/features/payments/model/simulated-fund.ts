export type SimulatedExpense = { id: string; amount: string; note: string; created_at: string };
export type SimulatedFund = {
  opening_balance: string;
  reserved_refund: string;
  entries: SimulatedExpense[];
};

const validMoney = (value: unknown): value is string => typeof value === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n;
const validEntry = (value: unknown): value is SimulatedExpense => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(row.id) &&
    validMoney(row.amount) && BigInt(row.amount) > 0n && typeof row.note === 'string' &&
    row.note === row.note.trim() && row.note.length > 0 && [...row.note].length <= 150 &&
    !/[\u0000-\u001f\u007f]/.test(row.note) && typeof row.created_at === 'string' &&
    Number.isFinite(Date.parse(row.created_at));
};

export function simulatedFundTotals(fund: SimulatedFund) {
  const spent = fund.entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  const balance = BigInt(fund.opening_balance) - spent;
  return { spent: spent.toString(), balance: balance.toString(), available: (balance - BigInt(fund.reserved_refund)).toString() };
}

export function isSimulatedFund(value: unknown): value is SimulatedFund {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!validMoney(row.opening_balance) || !validMoney(row.reserved_refund) ||
    !Array.isArray(row.entries) || row.entries.length > 200 || !row.entries.every(validEntry) ||
    new Set(row.entries.map(entry => entry.id)).size !== row.entries.length) return false;
  return BigInt(simulatedFundTotals(row as SimulatedFund).available) >= 0n;
}

export function createSimulatedFund(balance: string, reserved: string): SimulatedFund {
  const fund = { opening_balance: balance, reserved_refund: reserved, entries: [] };
  if (!isSimulatedFund(fund)) throw Error('Số dư khởi đầu cho mô phỏng không hợp lệ.');
  return fund;
}

/** A simulated payment commits its expense and balance together, once per payment ID. */
export function completeSimulatedExpense(fund: SimulatedFund, entry: SimulatedExpense): SimulatedFund {
  if (!isSimulatedFund(fund) || !validEntry(entry)) throw Error('Khoản chi mô phỏng không hợp lệ.');
  const existing = fund.entries.find(row => row.id === entry.id);
  if (existing) {
    if (existing.amount !== entry.amount || existing.note !== entry.note) throw Error('Mã thanh toán mô phỏng đã được sử dụng cho khoản khác.');
    return fund;
  }
  if (fund.entries.length >= 200) throw Error('Sổ mô phỏng đã đủ 200 khoản. Đặt lại sổ để thử tiếp.');
  if (BigInt(entry.amount) > BigInt(simulatedFundTotals(fund).available)) throw Error('Số dư mô phỏng không đủ sau khi giữ riêng khoản hoàn đang chờ.');
  return { ...fund, entries: [...fund.entries, { ...entry }] };
}
