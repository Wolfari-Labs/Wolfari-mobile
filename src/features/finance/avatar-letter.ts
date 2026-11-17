/**
 * Letter shown in a member's avatar circle. Vietnamese given names come last,
 * so "Huỳnh Bảo Quyên" shows "Q" and "Demo owner" shows "O".
 */
export function avatarLetter(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.at(-1)?.charAt(0).toLocaleUpperCase("vi-VN") || "?";
}
