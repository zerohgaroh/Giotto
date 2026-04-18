import type { RestaurantData } from "@/lib/types";

export type StaffRole = "waiter" | "manager";
export type ServiceTableStatus = "free" | "occupied" | "waiting" | "ordered" | "bill";
export type ServiceRequestType = "waiter" | "bill";
export type BillLineSource = "guest" | "waiter";
export type PushPlatform = "expo" | "ios" | "android" | "web";
export type FloorTableShape = "square" | "round" | "rect";
export type FloorTableSizePreset = "sm" | "md" | "lg";
export type ActivityActorRole = "guest" | "waiter" | "manager" | "system";
export type WaiterTaskType = "waiter_call" | "bill_request" | "follow_up";
export type WaiterTaskPriority = "urgent" | "normal";
export type WaiterTaskStatus = "open" | "acknowledged" | "in_progress" | "completed" | "cancelled";

export type WaiterProfile = {
  id: string;
  name: string;
  login: string;
  active: boolean;
  tableIds: number[];
};

export type ManagerProfile = {
  id: string;
  name: string;
  login: string;
  active: boolean;
};

export type HallTable = {
  tableId: number;
  status: ServiceTableStatus;
  assignedWaiterId?: string;
  guestStartedAt: number;
  hasActiveSession: boolean;
  doneCooldownUntil?: number;
};

export type FloorZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloorTableNode = {
  tableId: number;
  label?: string;
  x: number;
  y: number;
  shape: FloorTableShape;
  sizePreset: FloorTableSizePreset;
  archivedAt?: number;
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

export type Review = {
  tableId: number;
  waiterId?: string;
  rating: number;
  comment?: string;
  createdAt: number;
};

export type ReviewPrompt = {
  id: string;
  tableId: number;
  waiterId?: string;
  createdAt: number;
  expiresAt: number;
};

export type CooldownState = {
  type: ServiceRequestType;
  availableAt: number;
  remainingSec: number;
};

export type WaiterTableSummary = HallTable & {
  activeRequest?: ServiceRequest;
  openTasksCount: number;
  urgentTasksCount: number;
};

export type WaiterTableDetail = {
  waiter: WaiterProfile;
  table: HallTable;
  requests: ServiceRequest[];
  tasks: WaiterTask[];
  billLines: BillLine[];
  total: number;
  note: string;
  doneCooldownRemainingSec: number;
  reviewPrompt?: ReviewPrompt;
  timeline: WaiterTableTimelineEntry[];
};

export type WaiterTablesResponse = {
  waiter: WaiterProfile;
  tables: WaiterTableSummary[];
};

export type WaiterTask = {
  id: string;
  tableId: number;
  tableSessionId: string;
  waiterId?: string;
  type: WaiterTaskType;
  priority: WaiterTaskPriority;
  status: WaiterTaskStatus;
  sourceRequestId?: string;
  title: string;
  subtitle?: string;
  note?: string;
  createdAt: number;
  acknowledgedAt?: number;
  startedAt?: number;
  completedAt?: number;
  dueAt?: number;
};

export type WaiterQueueSummary = {
  urgentCount: number;
  inProgressCount: number;
  activeTablesCount: number;
};

export type WaiterQueueResponse = {
  waiter: WaiterProfile;
  summary: WaiterQueueSummary;
  tasks: WaiterTask[];
  tablesNeedingAttention: number[];
};

export type CreateFollowUpTaskInput = {
  title: string;
  dueInMin?: number;
  note?: string;
};

export type WaiterTableTimelineEntry = {
  id: string;
  type: string;
  ts: number;
  actorRole: ActivityActorRole;
  actorId?: string;
  payload?: Record<string, unknown>;
};

export type WaiterShortcutPresetItem = {
  dishId: string;
  qty: number;
};

export type WaiterQuickOrderPreset = {
  id: string;
  title: string;
  items: WaiterShortcutPresetItem[];
};

export type WaiterShortcuts = {
  favoriteDishIds: string[];
  noteTemplates: string[];
  quickOrderPresets: WaiterQuickOrderPreset[];
};

export type RepeatLastOrderInput = {
  sourceSessionId?: string;
  mutationKey?: string;
};

export type WaiterShiftSummary = {
  shiftStartedAt: number;
  tasksHandled: number;
  avgResponseSec: number;
  activeTablesCount: number;
  waiterOrdersCount: number;
  serviceCompletedCount: number;
};

export type WaiterOrderInput = {
  dishId?: string;
  title: string;
  qty: number;
  price: number;
  note?: string;
};

export type StaffUserPayload = {
  id: string;
  name: string;
  role: StaffRole;
};

export type StaffSession = {
  role: StaffRole;
  userId: string;
  name: string;
  sessionId: string;
  expiresAt: number;
};

export type StaffLoginResponse = {
  accessToken: string;
  refreshToken: string;
  role: StaffRole;
  user: StaffUserPayload;
  expiresAt: number;
};

export type PushDeviceRegistration = {
  token: string;
  platform: PushPlatform;
  appVersion?: string;
  deviceId?: string;
};

export type RealtimeEventType =
  | "waiter:called"
  | "bill:requested"
  | "waiter:acknowledged"
  | "waiter:done"
  | "order:added_by_waiter"
  | "review:submitted"
  | "table:status_changed"
  | "table:assignment_changed"
  | "menu:changed"
  | "table:created"
  | "table:archived"
  | "table:restored"
  | "floor:layout_changed"
  | "waiter:created"
  | "waiter:updated"
  | "waiter:deactivated"
  | "waiter:password_reset"
  | "task:created"
  | "task:updated"
  | "task:completed"
  | "shift:summary_changed";

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  tableId?: number;
  ts: number;
  actor?: string;
  payload?: Record<string, unknown>;
};

export type HallData = {
  waiters: WaiterProfile[];
  managers: ManagerProfile[];
  tables: HallTable[];
  requests: ServiceRequest[];
  billLines: BillLine[];
  notesByTable: Record<string, string>;
  notesBySession: Record<string, string>;
  requestCooldowns: Record<string, Partial<Record<ServiceRequestType, number>>>;
  reviews: Review[];
  reviewPrompts: Record<string, ReviewPrompt>;
  floorPlan: {
    tables: FloorTableNode[];
    zones: FloorZone[];
  };
  settings: { managerSoundEnabled: boolean };
};

export type StaffBootstrap = {
  session: StaffSession;
  restaurant: RestaurantData;
};

export type ManagerTableSummary = HallTable & {
  activeRequestsCount: number;
  total: number;
};

export type ManagerHallResponse = {
  manager: ManagerProfile;
  waiters: WaiterProfile[];
  tables: ManagerTableSummary[];
};

export type ManagerTableDetail = {
  table: HallTable;
  assignedWaiterId?: string;
  requests: ServiceRequest[];
  billLines: BillLine[];
  total: number;
  note: string;
  reviewPrompt?: ReviewPrompt;
  sessionId?: string;
  sessionStartedAt?: number;
  availableWaiters: WaiterProfile[];
};

export type ManagerHistoryEntry = {
  id: string;
  type: string;
  tableId?: number;
  tableSessionId?: string;
  ts: number;
  actorRole: ActivityActorRole;
  actorId?: string;
  payload?: Record<string, unknown>;
};

export type ManagerHistoryPage = {
  items: ManagerHistoryEntry[];
  nextCursor?: string;
};

export type ManagerReassignTableInput = {
  waiterId?: string;
};

export type ManagerWaiterSummary = WaiterProfile & {
  assignedTablesCount: number;
};

export type ManagerWaiterDetail = ManagerWaiterSummary & {
  canDeactivate: boolean;
  activeSessionTableIds: number[];
};

export type CreateWaiterInput = {
  name: string;
  login: string;
  password: string;
  tableIds: number[];
};

export type UpdateWaiterInput = {
  name?: string;
  login?: string;
  active?: boolean;
};

export type ResetWaiterPasswordInput = {
  password: string;
};

export type ReplaceWaiterAssignmentsInput = {
  tableIds: number[];
};

export type ManagerMenuSnapshot = Pick<RestaurantData, "categories" | "dishes">;

export type MenuCategoryInput = {
  labelRu: string;
  icon?: string;
  sortOrder?: number;
};

export type DishInput = {
  categoryId: string;
  nameRu: string;
  nameIt: string;
  description: string;
  price: number;
  image: string;
  portion: string;
  energyKcal: number;
  badgeLabel?: string;
  badgeTone?: "gold" | "navy" | "sage" | "blush";
  highlight?: boolean;
  available: boolean;
};

export type ManagerTableNode = FloorTableNode;

export type ManagerLayoutSnapshot = {
  activeTables: ManagerTableNode[];
  archivedTables: ManagerTableNode[];
  zones: FloorZone[];
};

export type UpdateLayoutInput = {
  tables: Array<{
    tableId: number;
    label?: string;
    x: number;
    y: number;
    shape: FloorTableShape;
    sizePreset: FloorTableSizePreset;
  }>;
  zones: FloorZone[];
};
