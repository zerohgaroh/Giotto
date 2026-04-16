import type { RestaurantData } from "@/lib/types";

export type ServiceTableStatus = "free" | "occupied" | "waiting" | "ordered" | "bill";
export type ServiceRequestType = "waiter" | "bill";
export type BillLineSource = "guest" | "waiter";
export type FloorTableShape = "square" | "round" | "rect";

export type WaiterProfile = {
  id: string;
  name: string;
  login: string;
  password: string;
  active: boolean;
  tableIds: number[];
};

export type HallTable = {
  tableId: number;
  status: ServiceTableStatus;
  assignedWaiterId?: string;
  guestStartedAt: number;
  doneCooldownUntil?: number;
};

export type ServiceRequest = {
  id: string;
  tableId: number;
  type: ServiceRequestType;
  reason: string;
  createdAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
};

export type BillLine = {
  id: string;
  tableId: number;
  dishId?: string;
  title: string;
  qty: number;
  price: number;
  source: BillLineSource;
  note?: string;
  createdAt: number;
};

export type FloorTableNode = {
  tableId: number;
  label?: string;
  x: number;
  y: number;
  shape: FloorTableShape;
};

export type FloorZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloorPlan = {
  tables: FloorTableNode[];
  zones: FloorZone[];
};

export type HallSettings = {
  managerSoundEnabled: boolean;
};

export type CooldownState = {
  type: ServiceRequestType;
  availableAt: number;
  remainingSec: number;
};

export type Review = {
  tableId: number;
  waiterId?: string;
  rating: number;
  comment?: string;
  createdAt: number;
};

export type ReviewPrompt = {
  tableId: number;
  waiterId?: string;
  createdAt: number;
  expiresAt: number;
};

export type TableCooldownMap = Record<string, Partial<Record<ServiceRequestType, number>>>;

export type HallData = {
  waiters: WaiterProfile[];
  tables: HallTable[];
  requests: ServiceRequest[];
  billLines: BillLine[];
  notesByTable: Record<string, string>;
  floorPlan: FloorPlan;
  settings: HallSettings;
  requestCooldowns?: TableCooldownMap;
  reviews?: Review[];
  reviewPrompts?: Record<string, ReviewPrompt>;
  notesBySession?: Record<string, string>;
};

export type AuthSession = {
  role: "waiter";
  waiterId: string;
  expiresAt: number;
};

export type WaiterTablesResponse = {
  waiter: WaiterProfile;
  tables: Array<HallTable & { activeRequest?: ServiceRequest }>;
};

export type WaiterTableDetailResponse = {
  waiter: WaiterProfile;
  table: HallTable;
  requests: ServiceRequest[];
  billLines: BillLine[];
  total: number;
  note: string;
  doneCooldownRemainingSec: number;
  reviewPrompt?: ReviewPrompt;
};

export type WaiterOrderInput = {
  dishId?: string;
  title: string;
  qty: number;
  price: number;
  note?: string;
};

export type RealtimeEventType =
  | "waiter:called"
  | "bill:requested"
  | "waiter:acknowledged"
  | "waiter:done"
  | "order:added_by_waiter"
  | "review:submitted"
  | "table:status_changed";

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  tableId: number;
  ts: number;
  actor?: string;
  payload?: Record<string, unknown>;
};

export type WaiterBackendSnapshot = {
  hall: HallData;
  restaurant: RestaurantData;
};
