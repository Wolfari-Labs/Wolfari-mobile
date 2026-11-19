// Compact brand labels reviewed against https://api.vietqr.io/v2/banks (2026-11-18).
// Bank codes remain unchanged in API requests.
import { resolveVietQrBank } from "./vietqr-banks.ts";

const names: Readonly<Record<string, string>> = {
  "ABB": "ABBANK · An Bình",
  "ACB": "ACB · Á Châu",
  "BAB": "Bắc Á Bank",
  "BIDV": "BIDV · Đầu tư và Phát triển",
  "BVB": "BaoViet Bank",
  "CAKE": "CAKE by VPBank",
  "CBB": "Vietcombank Neo",
  "CIMB": "CIMB Việt Nam",
  "COOPBANK": "Co-opBank · Hợp tác xã",
  "EIB": "Eximbank",
  "HDB": "HDBank",
  "ICB": "VietinBank · Công thương",
  "IVB": "Indovina Bank",
  "KBank": "KBank · Kasikornbank",
  "KBHCM": "KB Kookmin · TP. Hồ Chí Minh",
  "KBHN": "KB Kookmin · Hà Nội",
  "KLB": "KienlongBank",
  "LPB": "LPBank · Lộc Phát",
  "MB": "MB Bank · Quân đội",
  "MBV": "MBV · Việt Nam Hiện Đại",
  "momo": "Ví MoMo",
  "MSB": "MSB · Hàng Hải",
  "MVAS": "MobiFone · Dịch vụ số",
  "NAB": "Nam A Bank",
  "NCB": "NCB · Quốc Dân",
  "OCB": "OCB · Phương Đông",
  "PGB": "PGBank",
  "PVCB": "PVcomBank · Đại Chúng",
  "PVDB": "PVcomBank Pay",
  "SCB": "SCB · Sài Gòn",
  "SEAB": "SeABank · Đông Nam Á",
  "SGICB": "Saigonbank",
  "SHB": "SHB · Sài Gòn – Hà Nội",
  "SHBVN": "Shinhan Bank Việt Nam",
  "STB": "Sacombank",
  "TCB": "Techcombank · Kỹ thương",
  "TIMO": "Ngân hàng số Timo",
  "TPB": "TPBank · Tiên Phong",
  "Ubank": "Ubank by VPBank",
  "VAB": "VietABank",
  "VBA": "Agribank",
  "VCB": "Vietcombank · Ngoại thương",
  "VCCB": "Ngân hàng Bản Việt",
  "VIB": "VIB · Quốc tế",
  "VIETBANK": "Vietbank",
  "VPB": "VPBank · Việt Nam Thịnh Vượng",
  "WVN": "Woori Bank Việt Nam",
  "ZALOPAY": "Ví điện tử ZaloPay"
};

export function bankDisplayName(value: string): string {
  const bank = resolveVietQrBank(value);
  return bank ? names[bank.code] ?? bank.code : "Ngân hàng chưa nhận diện (BIN " + value + ")";
}
