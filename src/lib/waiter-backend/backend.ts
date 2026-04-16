import type { RestaurantData } from "@/lib/types";
import { MANAGER_SEED_ACCOUNTS } from "@/lib/manager-data";
import {
  getHallData as getLocalHallData,
  getRestaurantData as getLocalRestaurantData,
  resetHallData as resetLocalHallData,
  setHallData as setLocalHallData,
  setRestaurantData as setLocalRestaurantData,
} from "@/lib/server-state";
import { publishRealtimeEvent } from "./realtime";
import type {
  BillLine,
  CooldownState,
  HallData,
  HallTable,
  ManagerProfile,
  RealtimeEvent,
  Review,
  ServiceRequest,
  ServiceRequestType,
  WaiterBackendSnapshot,
  WaiterOrderInput,
  WaiterProfile,
  WaiterTableDetailResponse,
  WaiterTablesResponse,
} from "./types";

const REQUEST_COOLDOWN_MS = 120_000;
const REVIEW_PROMPT_TTL_MS = 60_000;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

type BackendKind = "demo" | "remote";

type WaiterBackend = {
  kind: BackendKind;
  getHallData: () => Promise<HallData>;
  setHallData: (hall: HallData) => Promise<HallData>;
  resetHallData: () => Promise<HallData>;
  getRestaurantData: () => Promise<RestaurantData>;
  setRestaurantData: (restaurant: RestaurantData) => Promise<RestaurantData>;
};

function toMillis(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 0;
  return value;
}

function toPositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function cloneHall(hall: HallData): HallData {
  return structuredClone(hall);
}

function tableExists(hall: HallData, tableId: number): HallTable {
  const table = hall.tables.find((item) => item.tableId === tableId);
  if (!table) throw new ApiError(404, "Стол не найден");
  return table;
}

function waiterExists(hall: HallData, waiterId: string): WaiterProfile {
  const waiter = hall.waiters.find((item) => item.id === waiterId && item.active);
  if (!waiter) throw new ApiError(401, "Сессия официанта недействительна");
  return waiter;
}

function managerExists(hall: HallData, managerId: string): ManagerProfile {
  const manager = (hall.managers ?? []).find((item) => item.id === managerId && item.active);
  if (!manager) throw new ApiError(401, "Сессия менеджера недействительна");
  return manager;
}

function ensureAssignedTable(hall: HallData, waiterId: string, tableId: number): HallTable {
  const table = tableExists(hall, tableId);
  if (table.assignedWaiterId !== waiterId) {
    throw new ApiError(403, "Стол не назначен этому официанту");
  }
  return table;
}

function ensureExtendedState(hall: HallData): HallData {
  if (!hall.managers || hall.managers.length === 0) {
    hall.managers = MANAGER_SEED_ACCOUNTS.map((account) => ({
      id: account.id,
      name: account.name,
      login: account.login,
      password: account.password,
      active: account.active,
    }));
  }
  if (!hall.requestCooldowns) hall.requestCooldowns = {};
  if (!hall.reviewPrompts) hall.reviewPrompts = {};
  if (!hall.reviews) hall.reviews = [];
  if (!hall.notesBySession) hall.notesBySession = {};
  return hall;
}

function buildSessionNoteKey(table: HallTable): string {
  return `${table.tableId}:${Math.floor(table.guestStartedAt)}`;
}

function resolveTableNote(hall: HallData, table: HallTable): string {
  const state = ensureExtendedState(hall);
  const sessionNote = state.notesBySession?.[buildSessionNoteKey(table)] ?? "";
  if (sessionNote) return sessionNote;
  return state.notesByTable[String(table.tableId)] ?? "";
}

function writeTableNote(hall: HallData, table: HallTable, note: string) {
  const state = ensureExtendedState(hall);
  const normalized = note.trim();
  const tableKey = String(table.tableId);
  const sessionKey = buildSessionNoteKey(table);

  if (normalized.length === 0) {
    delete state.notesBySession?.[sessionKey];
    delete state.notesByTable[tableKey];
    return;
  }

  state.notesBySession![sessionKey] = normalized;
  state.notesByTable[tableKey] = normalized;
}

function cleanupExpiredReviewPrompts(hall: HallData, now: number = Date.now()): boolean {
  const state = ensureExtendedState(hall);
  let changed = false;
  for (const [tableId, prompt] of Object.entries(state.reviewPrompts ?? {})) {
    if (prompt.expiresAt <= now) {
      delete state.reviewPrompts![tableId];
      changed = true;
    }
  }
  return changed;
}

function remainingSeconds(availableAt: number, now: number): number {
  if (availableAt <= now) return 0;
  return Math.max(1, Math.ceil((availableAt - now) / 1000));
}

function toCooldownState(type: ServiceRequestType, availableAt: number, now: number): CooldownState {
  return {
    type,
    availableAt,
    remainingSec: remainingSeconds(availableAt, now),
  };
}

function toWaiterTables(hall: HallData, waiterId: string): WaiterTablesResponse {
  const waiter = waiterExists(hall, waiterId);
  const tables = hall.tables
    .filter((table) => table.assignedWaiterId === waiterId)
    .sort((a, b) => a.tableId - b.tableId)
    .map((table) => {
      const activeRequest = hall.requests
        .filter((request) => request.tableId === table.tableId && !request.resolvedAt)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      return {
        ...table,
        activeRequest,
      };
    });

  return { waiter, tables };
}

function toWaiterTableDetail(hall: HallData, waiterId: string, tableId: number): WaiterTableDetailResponse {
  const waiter = waiterExists(hall, waiterId);
  const table = ensureAssignedTable(hall, waiterId, tableId);

  const requests = hall.requests
    .filter((request) => request.tableId === tableId && !request.resolvedAt)
    .sort((a, b) => b.createdAt - a.createdAt);

  const billLines = hall.billLines
    .filter((line) => line.tableId === tableId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const total = billLines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const doneCooldownRemainingSec = remainingSeconds(toMillis(table.doneCooldownUntil), Date.now());
  const reviewPrompt = hall.reviewPrompts?.[String(tableId)];

  return {
    waiter,
    table,
    requests,
    billLines,
    total,
    note: resolveTableNote(hall, table),
    doneCooldownRemainingSec,
    reviewPrompt,
  };
}

function emitEvents(events: RealtimeEventInput[]) {
  for (const event of events) {
    publishRealtimeEvent(event);
  }
}

function withRequestResolved(
  request: ServiceRequest,
  waiterId: string,
  now: number,
): ServiceRequest {
  return {
    ...request,
    acknowledgedAt: now,
    acknowledgedBy: waiterId,
    resolvedAt: now,
  };
}

function normalizeTableId(tableId: string | number): number {
  const parsed = Number(tableId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, "Неверный номер стола");
  }
  return Math.floor(parsed);
}

function isBackendUnavailable(error: unknown): error is BackendUnavailableError {
  return error instanceof BackendUnavailableError;
}

function getRemoteBaseUrl(): string {
  const configured = process.env.GIOTTO_BETA_SERVER_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/$/, "") : "http://localhost:3000";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new BackendUnavailableError("Удаленный сервер вернул некорректный JSON");
  }
}

async function requestRemote<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getRemoteBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new BackendUnavailableError("Не удалось подключиться к удаленному серверу");
  }

  if (!response.ok) {
    if (
      response.status >= 500 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status === 405
    ) {
      throw new BackendUnavailableError(`Удаленный сервер недоступен (${response.status})`);
    }
    throw new ApiError(response.status, `Ошибка удаленного сервера (${response.status})`);
  }

  return parseJsonResponse<T>(response);
}

function createDemoAdapter(): WaiterBackend {
  return {
    kind: "demo",
    async getHallData() {
      return (await getLocalHallData()) as HallData;
    },
    async setHallData(hall) {
      return (await setLocalHallData(hall as never)) as HallData;
    },
    async resetHallData() {
      return (await resetLocalHallData()) as HallData;
    },
    async getRestaurantData() {
      return await getLocalRestaurantData();
    },
    async setRestaurantData(restaurant) {
      return await setLocalRestaurantData(restaurant);
    },
  };
}

function createRemoteAdapter(): WaiterBackend {
  return {
    kind: "remote",
    async getHallData() {
      return await requestRemote<HallData>("/api/hall");
    },
    async setHallData(hall) {
      return await requestRemote<HallData>("/api/hall", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hall),
      });
    },
    async resetHallData() {
      return await requestRemote<HallData>("/api/hall/reset", {
        method: "POST",
      });
    },
    async getRestaurantData() {
      return await requestRemote<RestaurantData>("/api/restaurant");
    },
    async setRestaurantData(restaurant) {
      return await requestRemote<RestaurantData>("/api/restaurant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurant),
      });
    },
  };
}

const demoAdapter = createDemoAdapter();
const remoteAdapter = createRemoteAdapter();

async function withBackend<T>(task: (backend: WaiterBackend) => Promise<T>): Promise<T> {
  const forceDemo = process.env.GIOTTO_FORCE_DEMO_BACKEND === "1";
  if (forceDemo) return task(demoAdapter);

  try {
    return await task(remoteAdapter);
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    return await task(demoAdapter);
  }
}

async function readSnapshot(backend: WaiterBackend): Promise<WaiterBackendSnapshot> {
  const [hall, restaurant] = await Promise.all([
    backend.getHallData(),
    backend.getRestaurantData(),
  ]);

  return {
    hall: ensureExtendedState(cloneHall(hall)),
    restaurant,
  };
}

async function commitHall(backend: WaiterBackend, hall: HallData) {
  const cleaned = ensureExtendedState(hall);
  cleanupExpiredReviewPrompts(cleaned);
  await backend.setHallData(cleaned);
}

export async function authenticateWaiterCredentials(
  login: string,
  password: string,
): Promise<WaiterProfile | null> {
  const normalizedLogin = login.trim().toLowerCase();
  if (normalizedLogin.length === 0 || password.length === 0) return null;

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    return (
      hall.waiters.find(
        (waiter) =>
          waiter.active &&
          waiter.login.trim().toLowerCase() === normalizedLogin &&
          waiter.password === password,
      ) ?? null
    );
  });
}

export async function authenticateManagerCredentials(
  login: string,
  password: string,
): Promise<ManagerProfile | null> {
  const normalizedLogin = login.trim().toLowerCase();
  if (normalizedLogin.length === 0 || password.length === 0) return null;

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    return (
      (hall.managers ?? []).find(
        (manager) =>
          manager.active &&
          manager.login.trim().toLowerCase() === normalizedLogin &&
          manager.password === password,
      ) ?? null
    );
  });
}

export async function findWaiterById(waiterId: string): Promise<WaiterProfile | null> {
  if (!waiterId) return null;

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    return hall.waiters.find((waiter) => waiter.id === waiterId && waiter.active) ?? null;
  });
}

export async function findManagerById(managerId: string): Promise<ManagerProfile | null> {
  if (!managerId) return null;

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    try {
      return managerExists(hall, managerId);
    } catch {
      return null;
    }
  });
}

export async function getWaiterTables(waiterId: string): Promise<WaiterTablesResponse> {
  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    cleanupExpiredReviewPrompts(hall);
    return toWaiterTables(hall, waiterId);
  });
}

export async function getWaiterTableDetail(
  waiterId: string,
  tableIdInput: string | number,
): Promise<WaiterTableDetailResponse> {
  const tableId = normalizeTableId(tableIdInput);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    if (cleanupExpiredReviewPrompts(hall)) {
      await commitHall(backend, hall);
    }
    return toWaiterTableDetail(hall, waiterId, tableId);
  });
}

export async function acknowledgeWaiterRequest(params: {
  waiterId: string;
  tableId: string | number;
  requestId?: string;
}): Promise<WaiterTableDetailResponse> {
  const tableId = normalizeTableId(params.tableId);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    const table = ensureAssignedTable(hall, params.waiterId, tableId);

    const unresolved = hall.requests
      .filter((request) => request.tableId === tableId && !request.resolvedAt)
      .sort((a, b) => b.createdAt - a.createdAt);

    const request = params.requestId
      ? unresolved.find((item) => item.id === params.requestId)
      : unresolved[0];

    if (!request) {
      throw new ApiError(409, "Активный вызов не найден");
    }

    const now = Date.now();
    hall.requests = hall.requests.map((item) =>
      item.id === request.id ? withRequestResolved(item, params.waiterId, now) : item,
    );

    const previousStatus = table.status;
    hall.tables = hall.tables.map((item) =>
      item.tableId === tableId
        ? {
            ...item,
            status: "occupied",
          }
        : item,
    );

    await commitHall(backend, hall);

    const events: RealtimeEventInput[] = [
      {
        type: "waiter:acknowledged",
        tableId,
        actor: params.waiterId,
        payload: {
          requestId: request.id,
          acknowledgedAt: now,
          requestType: request.type,
        },
      },
    ];

    if (previousStatus !== "occupied") {
      events.push({
        type: "table:status_changed",
        tableId,
        actor: "system",
        payload: {
          from: previousStatus,
          to: "occupied",
        },
      });
    }

    emitEvents(events);
    return toWaiterTableDetail(hall, params.waiterId, tableId);
  });
}

export async function addWaiterOrder(params: {
  waiterId: string;
  tableId: string | number;
  items: WaiterOrderInput[];
}): Promise<WaiterTableDetailResponse> {
  const tableId = normalizeTableId(params.tableId);
  const validItems = params.items
    .map((item) => ({
      ...item,
      qty: toPositiveInt(item.qty),
      price: toPositiveInt(item.price),
      title: String(item.title ?? "").trim(),
      note: item.note ? String(item.note).trim() : undefined,
    }))
    .filter((item) => item.qty > 0 && item.price >= 0 && item.title.length > 0);

  if (validItems.length === 0) {
    throw new ApiError(400, "Нужна хотя бы одна позиция для добавления");
  }

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    const table = ensureAssignedTable(hall, params.waiterId, tableId);

    const now = Date.now();
    const nextLines: BillLine[] = validItems.map((item, index) => ({
      id: `waiter-${tableId}-${now}-${index}-${Math.random().toString(16).slice(2, 8)}`,
      tableId,
      dishId: item.dishId,
      title: item.title,
      qty: item.qty,
      price: item.price,
      source: "waiter",
      note: item.note,
      createdAt: now,
    }));

    const previousStatus = table.status;
    hall.billLines = [...hall.billLines, ...nextLines];
    hall.tables = hall.tables.map((item) =>
      item.tableId === tableId
        ? {
            ...item,
            status: "ordered",
            guestStartedAt: item.status === "free" ? now : item.guestStartedAt,
          }
        : item,
    );

    await commitHall(backend, hall);

    const totalAmount = nextLines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const events: RealtimeEventInput[] = [
      {
        type: "order:added_by_waiter",
        tableId,
        actor: params.waiterId,
        payload: {
          lines: nextLines.length,
          totalAmount,
        },
      },
    ];

    if (previousStatus !== "ordered") {
      events.push({
        type: "table:status_changed",
        tableId,
        actor: "system",
        payload: {
          from: previousStatus,
          to: "ordered",
        },
      });
    }

    emitEvents(events);
    return toWaiterTableDetail(hall, params.waiterId, tableId);
  });
}

export async function markWaiterDone(params: {
  waiterId: string;
  tableId: string | number;
}): Promise<WaiterTableDetailResponse> {
  const tableId = normalizeTableId(params.tableId);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    ensureAssignedTable(hall, params.waiterId, tableId);

    const now = Date.now();
    const expiresAt = now + REVIEW_PROMPT_TTL_MS;

    hall.tables = hall.tables.map((item) =>
      item.tableId === tableId
        ? {
            ...item,
            doneCooldownUntil: Math.max(toMillis(item.doneCooldownUntil), now + 30_000),
          }
        : item,
    );

    hall.reviewPrompts![String(tableId)] = {
      tableId,
      waiterId: params.waiterId,
      createdAt: now,
      expiresAt,
    };

    await commitHall(backend, hall);

    emitEvents([
      {
        type: "waiter:done",
        tableId,
        actor: params.waiterId,
        payload: {
          expiresAt,
        },
      },
    ]);

    return toWaiterTableDetail(hall, params.waiterId, tableId);
  });
}

export async function setWaiterTableNote(params: {
  waiterId: string;
  tableId: string | number;
  note: string;
}): Promise<WaiterTableDetailResponse> {
  const tableId = normalizeTableId(params.tableId);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    const table = ensureAssignedTable(hall, params.waiterId, tableId);
    writeTableNote(hall, table, params.note);
    await commitHall(backend, hall);
    return toWaiterTableDetail(hall, params.waiterId, tableId);
  });
}

export async function getGuestRequestCooldown(params: {
  tableId: string | number;
  type: ServiceRequestType;
}): Promise<CooldownState> {
  const tableId = normalizeTableId(params.tableId);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    tableExists(hall, tableId);
    const availableAt = hall.requestCooldowns?.[String(tableId)]?.[params.type] ?? 0;
    return toCooldownState(params.type, availableAt, Date.now());
  });
}

export async function createGuestRequest(params: {
  tableId: string | number;
  type: ServiceRequestType;
  reason?: string;
}): Promise<{ cooldown: CooldownState; accepted: boolean }> {
  const tableId = normalizeTableId(params.tableId);

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    const table = tableExists(hall, tableId);

    const now = Date.now();
    const tableKey = String(tableId);
    const currentAvailableAt = hall.requestCooldowns?.[tableKey]?.[params.type] ?? 0;

    if (currentAvailableAt > now) {
      return {
        cooldown: toCooldownState(params.type, currentAvailableAt, now),
        accepted: false,
      };
    }

    const availableAt = now + REQUEST_COOLDOWN_MS;
    const currentTableCooldowns = hall.requestCooldowns?.[tableKey] ?? {};
    hall.requestCooldowns![tableKey] = {
      ...currentTableCooldowns,
      [params.type]: availableAt,
    };

    const reason =
      params.reason?.trim() || (params.type === "bill" ? "Гости готовы оплатить" : "Гости вызывают официанта");

    const hasActiveRequest = hall.requests.some(
      (request) =>
        request.tableId === tableId && request.type === params.type && !request.resolvedAt,
    );

    if (!hasActiveRequest) {
      hall.requests = [
        ...hall.requests,
        {
          id: `rq-${params.type}-${tableId}-${now}`,
          tableId,
          type: params.type,
          reason,
          createdAt: now,
        },
      ];
    }

    const nextStatus = params.type === "bill" ? "bill" : "waiting";
    const previousStatus = table.status;
    hall.tables = hall.tables.map((item) =>
      item.tableId === tableId
        ? {
            ...item,
            status: nextStatus,
            guestStartedAt: item.status === "free" ? now : item.guestStartedAt,
          }
        : item,
    );

    await commitHall(backend, hall);

    const events: RealtimeEventInput[] = [
      {
        type: params.type === "bill" ? "bill:requested" : "waiter:called",
        tableId,
        actor: "guest",
        payload: {
          reason,
          cooldownAvailableAt: availableAt,
        },
      },
    ];

    if (previousStatus !== nextStatus) {
      events.push({
        type: "table:status_changed",
        tableId,
        actor: "system",
        payload: {
          from: previousStatus,
          to: nextStatus,
        },
      });
    }

    emitEvents(events);

    return {
      cooldown: toCooldownState(params.type, availableAt, now),
      accepted: true,
    };
  });
}

export async function submitGuestReview(params: {
  tableId: string | number;
  rating: number;
  comment?: string;
}): Promise<Review> {
  const tableId = normalizeTableId(params.tableId);
  const rating = Math.max(1, Math.min(5, Math.floor(params.rating)));

  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    const now = Date.now();

    cleanupExpiredReviewPrompts(hall, now);

    const prompt = hall.reviewPrompts?.[String(tableId)];
    if (!prompt) {
      throw new ApiError(409, "Запрос на отзыв не активен");
    }

    const table = tableExists(hall, tableId);
    const review: Review = {
      tableId,
      waiterId: prompt.waiterId ?? table.assignedWaiterId,
      rating,
      comment: params.comment?.trim() || undefined,
      createdAt: now,
    };

    hall.reviews = [...(hall.reviews ?? []), review];
    delete hall.reviewPrompts?.[String(tableId)];

    await commitHall(backend, hall);

    emitEvents([
      {
        type: "review:submitted",
        tableId,
        actor: "guest",
        payload: {
          rating,
          waiterId: review.waiterId,
        },
      },
    ]);

    return review;
  });
}

export async function getHallDataFromBackend(): Promise<HallData> {
  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.getHallData());
    if (cleanupExpiredReviewPrompts(hall)) {
      await commitHall(backend, hall);
    }
    return hall;
  });
}

export async function setHallDataFromBackend(hall: HallData): Promise<HallData> {
  return withBackend(async (backend) => {
    const normalized = ensureExtendedState(cloneHall(hall));
    cleanupExpiredReviewPrompts(normalized);
    return await backend.setHallData(normalized);
  });
}

export async function resetHallDataFromBackend(): Promise<HallData> {
  return withBackend(async (backend) => {
    const hall = ensureExtendedState(await backend.resetHallData());
    cleanupExpiredReviewPrompts(hall);
    return hall;
  });
}

export async function getRestaurantDataFromBackend(): Promise<RestaurantData> {
  return withBackend((backend) => backend.getRestaurantData());
}

export async function setRestaurantDataFromBackend(
  restaurant: RestaurantData,
): Promise<RestaurantData> {
  return withBackend((backend) => backend.setRestaurantData(restaurant));
}

export async function getWaiterSnapshot(waiterId: string) {
  return withBackend(async (backend) => {
    const snapshot = await readSnapshot(backend);
    const waiter = waiterExists(snapshot.hall, waiterId);
    return { waiter, kind: backend.kind };
  });
}
type RealtimeEventInput = Omit<RealtimeEvent, "id" | "ts"> &
  Partial<Pick<RealtimeEvent, "id" | "ts">>;
