// Mirror of Wolfari-backend packages/common/src/vietqr-banks.ts (codes/BINs; names live on the server, GET /api/v1/finance/banks).
// The backend resolves bank_code by code or BIN and fails closed (409) on unknown values,
// so the app validates against the same directory before writing a destination.
// Refresh together with the backend list; this is not bank verification.
export const VIETQR_BANKS: readonly { code: string; bin: string }[] = [
  {
    "code": "ABB",
    "bin": "970425"
  },
  {
    "code": "ACB",
    "bin": "970416"
  },
  {
    "code": "BAB",
    "bin": "970409"
  },
  {
    "code": "BIDV",
    "bin": "970418"
  },
  {
    "code": "BVB",
    "bin": "970438"
  },
  {
    "code": "CAKE",
    "bin": "546034"
  },
  {
    "code": "CBB",
    "bin": "970444"
  },
  {
    "code": "CIMB",
    "bin": "422589"
  },
  {
    "code": "COOPBANK",
    "bin": "970446"
  },
  {
    "code": "EIB",
    "bin": "970431"
  },
  {
    "code": "HDB",
    "bin": "970437"
  },
  {
    "code": "ICB",
    "bin": "970415"
  },
  {
    "code": "IVB",
    "bin": "970434"
  },
  {
    "code": "KBank",
    "bin": "668888"
  },
  {
    "code": "KBHCM",
    "bin": "970463"
  },
  {
    "code": "KBHN",
    "bin": "970462"
  },
  {
    "code": "KLB",
    "bin": "970452"
  },
  {
    "code": "LPB",
    "bin": "970449"
  },
  {
    "code": "MB",
    "bin": "970422"
  },
  {
    "code": "MBV",
    "bin": "970414"
  },
  {
    "code": "momo",
    "bin": "971025"
  },
  {
    "code": "MSB",
    "bin": "970426"
  },
  {
    "code": "MVAS",
    "bin": "971032"
  },
  {
    "code": "NAB",
    "bin": "970428"
  },
  {
    "code": "NCB",
    "bin": "970419"
  },
  {
    "code": "OCB",
    "bin": "970448"
  },
  {
    "code": "PGB",
    "bin": "970430"
  },
  {
    "code": "PVCB",
    "bin": "970412"
  },
  {
    "code": "PVDB",
    "bin": "971133"
  },
  {
    "code": "SCB",
    "bin": "970429"
  },
  {
    "code": "SEAB",
    "bin": "970440"
  },
  {
    "code": "SGICB",
    "bin": "970400"
  },
  {
    "code": "SHB",
    "bin": "970443"
  },
  {
    "code": "SHBVN",
    "bin": "970424"
  },
  {
    "code": "STB",
    "bin": "970403"
  },
  {
    "code": "TCB",
    "bin": "970407"
  },
  {
    "code": "TIMO",
    "bin": "963388"
  },
  {
    "code": "TPB",
    "bin": "970423"
  },
  {
    "code": "Ubank",
    "bin": "546035"
  },
  {
    "code": "VAB",
    "bin": "970427"
  },
  {
    "code": "VBA",
    "bin": "970405"
  },
  {
    "code": "VCB",
    "bin": "970436"
  },
  {
    "code": "VCCB",
    "bin": "970454"
  },
  {
    "code": "VIB",
    "bin": "970441"
  },
  {
    "code": "VIETBANK",
    "bin": "970433"
  },
  {
    "code": "VPB",
    "bin": "970432"
  },
  {
    "code": "WVN",
    "bin": "970457"
  },
  {
    "code": "ZALOPAY",
    "bin": "971101"
  }
];

export function resolveVietQrBank(input: string) {
  const value = input.trim().toUpperCase();
  return value ? VIETQR_BANKS.find(bank => bank.code.toUpperCase() === value || bank.bin === value) : undefined;
}

/** Backend QuickLink accepts 1..19 ASCII letters/digits for the account. */
export function validVietQrAccount(value: string) {
  return /^[A-Za-z0-9]{1,19}$/.test(value.trim());
}
