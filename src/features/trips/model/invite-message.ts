/**
 * Text for the OS share sheet (Zalo, Messenger…): the web link that opens the invitation on any
 * device, the short code as a fallback, and how many people it admits.
 */
export function inviteMessage({
  tripName,
  code,
  expiresLabel,
  link,
  maxUses = 1,
}: {
  tripName: string;
  code: string;
  expiresLabel: string;
  link?: string;
  maxUses?: number;
}): string {
  return [
    `Mình mời bạn tham gia chuyến đi "${tripName}" trên Wolfari!`,
    ...(link ? [`Mở lời mời: ${link}`] : []),
    `Mã mời: ${code}`,
    `Hoặc mở app Wolfari → Tài khoản → Tham gia bằng mã mời rồi nhập mã.`,
    maxUses > 1
      ? `Mã dùng cho tối đa ${maxUses} người, hết hạn ${expiresLabel}.`
      : `Mã dùng một lần, hết hạn ${expiresLabel}.`,
  ].join("\n");
}
