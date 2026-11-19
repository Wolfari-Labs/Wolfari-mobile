/** Text for the OS share sheet: the short join code and how to use it; no raw links. */
export function inviteMessage({
  tripName,
  code,
  expiresLabel,
}: {
  tripName: string;
  code: string;
  expiresLabel: string;
}): string {
  return [
    `Mình mời bạn tham gia chuyến đi "${tripName}" trên Wolfari!`,
    `Mã mời: ${code}`,
    `Mở app Wolfari → Tài khoản → Lời mời chuyến đi rồi nhập mã.`,
    `Mã dùng một lần, hết hạn ${expiresLabel}.`,
  ].join("\n");
}
