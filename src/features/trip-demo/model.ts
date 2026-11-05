// Deliberately independent of the API and storage. This is a UI sandbox, not a ledger.
export const demoMembers = [
  { id: "mai", name: "Mai", initials: "MA", color: "#DCEEE8", role: "Giữ quỹ" },
  {
    id: "an",
    name: "An",
    initials: "AN",
    color: "#F7E7CF",
    role: "Thành viên",
  },
  {
    id: "linh",
    name: "Linh",
    initials: "LI",
    color: "#E5E2F5",
    role: "Thành viên",
  },
  {
    id: "minh",
    name: "Minh",
    initials: "MI",
    color: "#DDECF7",
    role: "Thành viên",
  },
] as const;
export const categories = [
  "Giấy tờ",
  "Quần áo",
  "Vệ sinh",
  "Điện tử",
  "Y tế",
  "Khác",
];
export const palettes = [
  {
    id: "coast",
    name: "Biển & mây",
    colors: ["#B5D8E8", "#FFFFFF", "#E5D7C3"],
  },
  {
    id: "earth",
    name: "Nắng Hội An",
    colors: ["#C77D51", "#F3D792", "#F7EFE0"],
  },
  {
    id: "forest",
    name: "Xanh dịu dàng",
    colors: ["#7D9D88", "#D9E5CE", "#FAF5E9"],
  },
  {
    id: "mono",
    name: "Đen & trắng",
    colors: ["#30343A", "#C9CCD1", "#FFFFFF"],
  },
] as const;
export const demoDays = ["12/11/2026", "13/11/2026", "14/11/2026"];
export const demoActivities = [
  { id: "beach", title: "Dạo biển Mỹ Khê", day: demoDays[0] },
  { id: "hoian", title: "Một chiều ở Hội An", day: demoDays[1] },
  { id: "coffee", title: "Cà phê trước giờ về", day: demoDays[2] },
];
export type TripDetails = {
  name: string;
  destination: string;
  budget: string;
  travelers: string;
  description: string;
  style: "explore" | "relax" | "food";
  cover: "tripCover" | "dalat" | "coast";
  coverUri?: string;
};
export type DemoPacking = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  assignee: string;
  note: string;
  done: boolean;
};
export type DemoDress = {
  id: string;
  label: string;
  scope: "TRIP" | "DAY" | "ACTIVITY";
  day: string;
  activity: string;
  palette: string;
  description: string;
};
export type EntryKind = "contribution" | "expense" | "refund" | "outside";
export type DemoEntry = {
  id: string;
  kind: EntryKind;
  title: string;
  amount: string;
  member: string;
  category: string;
  date: string;
  note: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
};
export type DemoState = {
  details: TripDetails;
  packing: DemoPacking[];
  dress: DemoDress[];
  entries: DemoEntry[];
  history: { id: string; text: string }[];
};
export type DemoAction =
  | { type: "details"; value: TripDetails }
  | { type: "packing.save"; value: DemoPacking }
  | { type: "packing.toggle" | "packing.delete" | "dress.delete"; id: string }
  | { type: "dress.save"; value: DemoDress }
  | { type: "entry.add"; value: DemoEntry }
  | { type: "entry.confirm" | "entry.cancel"; id: string }
  | { type: "reset" };

export function createDemoState(): DemoState {
  return {
    details: {
      name: "Đà Nẵng, mình đi nhé!",
      destination: "Đà Nẵng · Hội An",
      budget: "12000000",
      travelers: "4",
      description:
        "Ba ngày bên biển, một chiều phố cổ và thật nhiều ảnh cùng nhau.",
      style: "explore",
      cover: "coast",
    },
    packing: [
      {
        id: "p1",
        name: "Căn cước & vé máy bay",
        quantity: "1",
        unit: "bộ",
        category: "Giấy tờ",
        assignee: "mai",
        note: "Lưu thêm bản điện tử trên điện thoại.",
        done: true,
      },
      {
        id: "p2",
        name: "Kem chống nắng",
        quantity: "2",
        unit: "tuýp",
        category: "Vệ sinh",
        assignee: "linh",
        note: "Một tuýp dùng chung cho cả nhóm.",
        done: false,
      },
      {
        id: "p3",
        name: "Áo sơ mi trắng",
        quantity: "1",
        unit: "chiếc",
        category: "Quần áo",
        assignee: "mai",
        note: "Mặc chụp ảnh ở biển ngày đầu tiên.",
        done: false,
      },
      {
        id: "p4",
        name: "Sạc dự phòng",
        quantity: "2",
        unit: "cái",
        category: "Điện tử",
        assignee: "minh",
        note: "Nhớ sạc đầy trước khi khởi hành.",
        done: true,
      },
      {
        id: "p5",
        name: "Túi thuốc nhỏ",
        quantity: "1",
        unit: "túi",
        category: "Y tế",
        assignee: "an",
        note: "Băng cá nhân và thuốc cá nhân cần dùng.",
        done: false,
      },
    ],
    dress: [
      {
        id: "d1",
        label: "Chạm vào mùa biển",
        scope: "DAY",
        day: demoDays[0],
        activity: "",
        palette: "coast",
        description:
          "Trắng, xanh nhạt và chất liệu thoáng. Mang sandal để đi dạo trên cát.",
      },
      {
        id: "d2",
        label: "Hẹn nhau ở phố cổ",
        scope: "ACTIVITY",
        day: "",
        activity: "hoian",
        palette: "earth",
        description: "Tông be hoặc nâu ấm, thêm một chiếc nón cói là đủ đẹp.",
      },
    ],
    entries: [
      {
        id: "e1",
        kind: "contribution",
        title: "Mai góp quỹ đợt 1",
        amount: "3000000",
        member: "mai",
        category: "Góp quỹ",
        date: "2026-11-01",
        note: "",
        status: "CONFIRMED",
      },
      {
        id: "e2",
        kind: "contribution",
        title: "An góp quỹ đợt 1",
        amount: "3000000",
        member: "an",
        category: "Góp quỹ",
        date: "2026-11-01",
        note: "",
        status: "CONFIRMED",
      },
      {
        id: "e3",
        kind: "expense",
        title: "Đặt phòng gần biển",
        amount: "2400000",
        member: "mai",
        category: "Lưu trú",
        date: "2026-11-02",
        note: "Hai phòng, hai đêm.",
        status: "CONFIRMED",
      },
      {
        id: "e4",
        kind: "contribution",
        title: "Linh báo đã góp quỹ",
        amount: "3000000",
        member: "linh",
        category: "Góp quỹ",
        date: "2026-11-03",
        note: "Đang chờ người giữ quỹ kiểm tra.",
        status: "PENDING",
      },
      {
        id: "e5",
        kind: "refund",
        title: "Hoàn khoản ứng trước",
        amount: "300000",
        member: "an",
        category: "Hoàn tiền",
        date: "2026-11-03",
        note: "Đã dành riêng, chưa ghi nhận chi hoàn.",
        status: "PENDING",
      },
      {
        id: "e6",
        kind: "outside",
        title: "Cà phê tại sân bay",
        amount: "180000",
        member: "minh",
        category: "Ăn uống",
        date: "2026-11-12",
        note: "Minh tự trả, không trừ quỹ chung.",
        status: "CONFIRMED",
      },
    ],
    history: [
      {
        id: "initial",
        text: "Khởi tạo sổ quỹ minh họa · Không có giao dịch thực tế",
      },
    ],
  };
}

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
export function formatMoney(amount: number | string) {
  return moneyFormatter.format(Number(amount));
}
export function parseAmount(raw: string) {
  if (!/^[1-9]\d{0,11}$/.test(raw))
    throw new Error(
      "Nhập số tiền nguyên VND từ 1 đến 999.999.999.999, không dấu phân cách.",
    );
  return Number(raw);
}
export function fundTotals(entries: DemoEntry[]) {
  const sum = (kind: EntryKind, status = "CONFIRMED") =>
    entries
      .filter((e) => e.kind === kind && e.status === status)
      .reduce((total, e) => total + Number(e.amount), 0);
  const contributed = sum("contribution"),
    spent = sum("expense"),
    refunded = sum("refund");
  const reserved = sum("refund", "PENDING"),
    balance = contributed - spent - refunded;
  return {
    contributed,
    spent,
    refunded,
    reserved,
    balance,
    available: balance - reserved,
    pending: sum("contribution", "PENDING"),
    outside: sum("outside"),
  };
}
function requireText(value: string, label: string, max = 200) {
  if (!value.trim() || value.trim().length > max)
    throw new Error(`${label} cần từ 1 đến ${max} ký tự.`);
}
function member(id: string, optional = false) {
  if (!(optional && !id) && !demoMembers.some((m) => m.id === id))
    throw new Error("Chọn một thành viên trong nhóm mẫu.");
}
function upsert<T extends { id: string }>(rows: T[], value: T): T[] {
  if (!value.id) throw new Error("Thiếu mã mục dữ liệu mẫu.");
  if (!rows.some((r) => r.id === value.id) && rows.length >= 100)
    throw new Error("Bản mẫu hỗ trợ tối đa 100 mục.");
  return rows.some((r) => r.id === value.id)
    ? rows.map((r) => (r.id === value.id ? value : r))
    : [...rows, value];
}
export function applyDemoAction(
  state: DemoState,
  action: DemoAction,
): DemoState {
  switch (action.type) {
    case "reset":
      return createDemoState();
    case "details": {
      const value = action.value;
      requireText(value.name, "Tên chuyến đi");
      requireText(value.destination, "Điểm đến");
      if (!["explore", "relax", "food"].includes(value.style))
        throw new Error("Chọn phong cách chuyến đi hợp lệ.");
      if (!["tripCover", "dalat", "coast"].includes(value.cover))
        throw new Error("Chọn ảnh bìa mẫu hợp lệ.");
      parseAmount(value.budget);
      if (!/^([1-9]|1\d|20)$/.test(value.travelers))
        throw new Error("Số người dự kiến từ 1 đến 20.");
      if (value.description.length > 1000)
        throw new Error("Lời nhắn tối đa 1.000 ký tự.");
      return {
        ...state,
        details: {
          ...value,
          name: value.name.trim(),
          destination: value.destination.trim(),
        },
      };
    }
    case "packing.save": {
      const value = action.value;
      requireText(value.name, "Tên vật dụng");
      requireText(value.unit, "Đơn vị", 30);
      if (!/^\d{1,3}$/.test(value.quantity) || Number(value.quantity) < 1)
        throw new Error("Số lượng từ 1 đến 999.");
      if (!categories.includes(value.category))
        throw new Error("Chọn danh mục hợp lệ.");
      member(value.assignee, true);
      if (value.note.length > 500) throw new Error("Ghi chú tối đa 500 ký tự.");
      return {
        ...state,
        packing: upsert(state.packing, { ...value, name: value.name.trim() }),
      };
    }
    case "packing.toggle":
      return {
        ...state,
        packing: state.packing.map((p) =>
          p.id === action.id ? { ...p, done: !p.done } : p,
        ),
      };
    case "packing.delete":
      return {
        ...state,
        packing: state.packing.filter((p) => p.id !== action.id),
      };
    case "dress.delete":
      return { ...state, dress: state.dress.filter((d) => d.id !== action.id) };
    case "dress.save": {
      const value = action.value;
      requireText(value.label, "Tên dress code", 100);
      if (!["TRIP", "DAY", "ACTIVITY"].includes(value.scope))
        throw new Error("Chọn phạm vi dress code hợp lệ.");
      if (!palettes.some((p) => p.id === value.palette))
        throw new Error("Chọn bảng màu hợp lệ.");
      if (value.scope === "DAY" && !demoDays.includes(value.day))
        throw new Error("Chọn ngày trong chuyến đi mẫu.");
      if (
        value.scope === "ACTIVITY" &&
        !demoActivities.some((a) => a.id === value.activity)
      )
        throw new Error("Chọn một hoạt động mẫu.");
      if (value.description.length > 500)
        throw new Error("Mô tả tối đa 500 ký tự.");
      return {
        ...state,
        dress: upsert(state.dress, {
          ...value,
          label: value.label.trim(),
          day: value.scope === "DAY" ? value.day : "",
          activity: value.scope === "ACTIVITY" ? value.activity : "",
        }),
      };
    }
    case "entry.add": {
      const value = action.value;
      requireText(value.id, "Mã khoản mẫu");
      if (state.entries.some((e) => e.id === value.id)) return state;
      if (state.entries.length >= 100)
        throw new Error("Sổ quỹ mẫu hỗ trợ tối đa 100 khoản.");
      if (!["contribution", "expense", "refund", "outside"].includes(value.kind))
        throw new Error("Chọn loại khoản hợp lệ.");
      requireText(value.title, "Nội dung");
      member(value.member);
      parseAmount(value.amount);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
        !Number.isFinite(Date.parse(value.date)) ||
        new Date(value.date).toISOString().slice(0, 10) !== value.date
      )
        throw new Error("Nhập ngày hợp lệ YYYY-MM-DD.");
      if (value.note.length > 500) throw new Error("Ghi chú tối đa 500 ký tự.");
      if (
        value.kind === "refund" &&
        Number(value.amount) > fundTotals(state.entries).available
      )
        throw new Error("Khoản hoàn vượt số dư khả dụng của quỹ mẫu.");
      return {
        ...state,
        entries: [
          ...state.entries,
          { ...value, title: value.title.trim(), status: "PENDING" },
        ],
        history: [
          {
            id: value.id + "-new",
            text: `Tạo khoản chờ xử lý: ${value.title} · ${formatMoney(value.amount)}`,
          },
          ...state.history,
        ],
      };
    }
    case "entry.confirm":
    case "entry.cancel": {
      const entry = state.entries.find((e) => e.id === action.id);
      if (!entry || entry.status !== "PENDING") return state;
      const confirm = action.type === "entry.confirm";
      if (
        confirm &&
        entry.kind === "expense" &&
        Number(entry.amount) > fundTotals(state.entries).available
      )
        throw new Error(
          "Số dư khả dụng không đủ. Quỹ mẫu đã giữ riêng khoản hoàn đang chờ.",
        );
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id
            ? { ...e, status: confirm ? "CONFIRMED" : "CANCELLED" }
            : e,
        ),
        history: [
          {
            id: entry.id + "-resolved",
            text: `${confirm ? "Xác nhận mô phỏng" : "Hủy khoản mẫu"}: ${entry.title} · ${formatMoney(entry.amount)}`,
          },
          ...state.history,
        ],
      };
    }
  }
}
