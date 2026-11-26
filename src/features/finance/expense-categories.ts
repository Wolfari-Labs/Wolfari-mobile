import type { Transaction } from "./types";

export const EXPENSE_CATEGORIES = ["Ăn uống", "Di chuyển", "Lưu trú", "Vé tham quan", "Mua sắm", "Khác"] as const;

/** Badge for an expense; free-text categories from older entries fall back by keyword. */
export function expenseBadge(category: string | null, title = "") {
  const text = (category?.trim() || title).toLocaleLowerCase("vi");
  if (/di chuyển|taxi|xe|máy bay|tàu|xăng/.test(text)) return { icon: "car", tone: "blue" } as const;
  if (/lưu trú|khách sạn|homestay|phòng/.test(text)) return { icon: "bag", tone: "lilac" } as const;
  if (/ăn|uống|cà phê|nhà hàng|bữa/.test(text)) return { icon: "cup", tone: "peach" } as const;
  if (/vé|tham quan/.test(text)) return { icon: "ticket", tone: "butter" } as const;
  return { icon: "wallet", tone: "mint" } as const;
}

/** M14 reports contributions and expenses separately. Refunds still affect the server balance. */
export function fundTotals(rows: Transaction[]) {
  const typesById = new Map(rows.map(row => [row.id, row.transaction_type]));
  let contributed = 0n, spent = 0n;
  for (const row of rows) {
    const reversing = row.transaction_type === "REVERSAL";
    let type = row.transaction_type;
    if (reversing) {
      const original = row.reversal_of_id && typesById.get(row.reversal_of_id);
      if (original) type = original;
      else if (row.expense_id) type = "EXPENSE";
      else if (row.contribution_id) type = "CONTRIBUTION";
      else if (row.refund_id) type = "REFUND";
      else throw Error("Chưa xác định được giao dịch gốc của bút toán đảo.");
    }
    const amount = BigInt(row.amount) * (reversing ? -1n : 1n);
    if (type === "CONTRIBUTION") contributed += amount;
    if (type === "EXPENSE") spent += amount;
  }
  return { contributed: String(contributed), spent: String(spent) };
}
