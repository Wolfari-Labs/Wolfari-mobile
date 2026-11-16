import type { Activity, DressCode, DressCodeInput } from "../types";

/** Server dress codes (FR-PL03, API051–053): form state, validation and grouping. */
export type DressScope = DressCode["scope_type"];
export type DressCodeForm = {
  id?: string;
  label: string;
  scope: DressScope;
  date: string;
  activity: string;
  description: string;
};

export const DRESS_LABEL_MAX = 100;
export const DRESS_TEXT_MAX = 10_000;
export const dressScopes: { value: DressScope; label: string }[] = [
  { value: "TRIP", label: "Cả chuyến" },
  { value: "DAY", label: "Theo ngày" },
  { value: "ACTIVITY", label: "Hoạt động" },
];

export function dressCodeForm(code: DressCode | undefined, days: string[], activities: Pick<Activity, "id">[]): DressCodeForm {
  return {
    id: code?.id,
    label: code?.label ?? "",
    scope: code?.scope_type ?? "TRIP",
    // Pre-fill the other scopes so switching scope always lands on a valid choice.
    date: code?.plan_date ?? days[0] ?? "",
    activity: code?.activity_id ?? activities[0]?.id ?? "",
    description: code?.description ?? "",
  };
}

/** Returns the request body, or a Vietnamese message naming the field to fix. */
export function dressCodeInput(
  form: DressCodeForm,
  context: { planVersion: number; days: string[]; activities: Pick<Activity, "id">[] },
): { input: DressCodeInput } | { error: string } {
  const label = form.label.trim(), description = form.description.trim();
  if (!label) return { error: "Nhập tên dress code." };
  if ([...label].length > DRESS_LABEL_MAX) return { error: `Tên dress code tối đa ${DRESS_LABEL_MAX} ký tự.` };
  if ([...description].length > DRESS_TEXT_MAX) return { error: "Mô tả quá dài." };
  if (form.scope === "DAY" && !context.days.includes(form.date)) return { error: "Chọn một ngày trong chuyến đi." };
  if (form.scope === "ACTIVITY" && !context.activities.some(item => item.id === form.activity))
    return { error: "Chọn một hoạt động hiện có; thêm hoạt động trước nếu danh sách trống." };
  return {
    input: {
      scope_type: form.scope,
      // Exactly one scope: the references of the other scopes are cleared explicitly.
      plan_date: form.scope === "DAY" ? form.date : null,
      activity_id: form.scope === "ACTIVITY" ? form.activity : null,
      label,
      description: description || null,
      expected_plan_version: context.planVersion,
    },
  };
}

export function dressScopeLabel(code: Pick<DressCode, "scope_type" | "plan_date" | "activity_id">, activities: Pick<Activity, "id" | "title">[]) {
  if (code.scope_type === "TRIP") return "Cả hành trình";
  if (code.scope_type === "DAY") return code.plan_date ? `Ngày ${code.plan_date.slice(8, 10)}/${code.plan_date.slice(5, 7)}` : "Ngày chưa xác định";
  return activities.find(item => item.id === code.activity_id)?.title ?? "Hoạt động không còn trong kế hoạch";
}

export function dressDayLabel(day: string) {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}
