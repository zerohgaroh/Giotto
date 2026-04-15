"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WAITER_SEED_ACCOUNTS } from "./waiter-data";

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

export type HallData = {
  waiters: WaiterProfile[];
  tables: HallTable[];
  requests: ServiceRequest[];
  billLines: BillLine[];
  notesByTable: Record<string, string>;
  floorPlan: FloorPlan;
  settings: HallSettings;
};

const STORAGE_KEY = "giotto.hall.data.v1";
const UPDATE_EVENT = "giotto:hall-data-updated";

const TABLE_STATUSES: ServiceTableStatus[] = ["free", "occupied", "waiting", "ordered", "bill"];

function isValidStatus(value: unknown): value is ServiceTableStatus {
  return typeof value === "string" && TABLE_STATUSES.includes(value as ServiceTableStatus);
}

function clampPercent(value: number) {
  return Math.min(96, Math.max(4, value));
}

function buildDefaultFloorPlan(tables: HallTable[]): FloorPlan {
  const columns = 5;
  const tablesNodes: FloorTableNode[] = tables.map((table, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      tableId: table.tableId,
      label: `Стол ${table.tableId}`,
      x: 12 + col * 20,
      y: 16 + row * 17,
      shape: col % 3 === 0 ? "round" : col % 2 === 0 ? "rect" : "square",
    };
  });

  const zones: FloorZone[] = [
    {
      id: "zone-main",
      label: "Основной зал",
      x: 8,
      y: 8,
      width: 62,
      height: 56,
    },
    {
      id: "zone-terrace",
      label: "Терраса",
      x: 72,
      y: 12,
      width: 22,
      height: 36,
    },
  ];

  return { tables: tablesNodes, zones };
}

function syncAssignments(waiters: WaiterProfile[], tables: HallTable[]) {
  const waiterIds = new Set(waiters.map((waiter) => waiter.id));

  const normalizedTables = tables.map((table) => {
    if (!table.assignedWaiterId) return table;
    if (waiterIds.has(table.assignedWaiterId)) return table;
    return { ...table, assignedWaiterId: undefined };
  });

  const tableIdsByWaiter = new Map<string, number[]>();
  for (const table of normalizedTables) {
    if (!table.assignedWaiterId) continue;
    const list = tableIdsByWaiter.get(table.assignedWaiterId) ?? [];
    list.push(table.tableId);
    tableIdsByWaiter.set(table.assignedWaiterId, list);
  }

  const normalizedWaiters = waiters.map((waiter) => ({
    ...waiter,
    tableIds: (tableIdsByWaiter.get(waiter.id) ?? []).sort((a, b) => a - b),
  }));

  return { waiters: normalizedWaiters, tables: normalizedTables };
}

function buildDefaultHallData(): HallData {
  const now = Date.now();
  const waiters: WaiterProfile[] = WAITER_SEED_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    login: account.login,
    password: account.password,
    active: account.active,
    tableIds: account.tableIds,
  }));

  const tableAssignments = new Map<number, string>();
  for (const waiter of waiters) {
    for (const tableId of waiter.tableIds) {
      tableAssignments.set(tableId, waiter.id);
    }
  }

  const tables: HallTable[] = Array.from({ length: 20 }, (_, index) => {
    const tableId = index + 1;
    const assignedWaiterId = tableAssignments.get(tableId);

    if (tableId === 3) {
      return {
        tableId,
        assignedWaiterId,
        status: "waiting",
        guestStartedAt: now - 42 * 60 * 1000,
      };
    }

    if (tableId === 5) {
      return {
        tableId,
        assignedWaiterId,
        status: "bill",
        guestStartedAt: now - 71 * 60 * 1000,
      };
    }

    if (tableId === 7) {
      return {
        tableId,
        assignedWaiterId,
        status: "ordered",
        guestStartedAt: now - 27 * 60 * 1000,
      };
    }

    if (tableId <= 12) {
      return {
        tableId,
        assignedWaiterId,
        status: "occupied",
        guestStartedAt: now - (14 + tableId * 2) * 60 * 1000,
      };
    }

    return {
      tableId,
      assignedWaiterId,
      status: "free",
      guestStartedAt: now,
    };
  });

  const requests: ServiceRequest[] = [
    {
      id: "rq-w-3",
      tableId: 3,
      type: "waiter",
      reason: "Вопрос по блюду",
      createdAt: now - 3 * 60 * 1000,
    },
    {
      id: "rq-b-5",
      tableId: 5,
      type: "bill",
      reason: "Гости готовы оплатить",
      createdAt: now - 2 * 60 * 1000,
    },
  ];

  const billLines: BillLine[] = [
    {
      id: "line-3-1",
      tableId: 3,
      title: "Tagliatelle al tartufo",
      dishId: "tagliatelle",
      qty: 1,
      price: 198000,
      source: "guest",
      note: "Прожарка: medium rare",
      createdAt: now - 24 * 60 * 1000,
    },
    {
      id: "line-3-2",
      tableId: 3,
      title: "Acqua Panna",
      qty: 2,
      price: 28000,
      source: "waiter",
      createdAt: now - 10 * 60 * 1000,
    },
    {
      id: "line-5-1",
      tableId: 5,
      title: "Risotto ai funghi",
      dishId: "risotto",
      qty: 2,
      price: 132000,
      source: "guest",
      createdAt: now - 38 * 60 * 1000,
    },
  ];

  const synced = syncAssignments(waiters, tables);

  return {
    waiters: synced.waiters,
    tables: synced.tables,
    requests,
    billLines,
    notesByTable: {
      "3": "Аллергия на орехи",
      "5": "Гости празднуют день рождения",
    },
    floorPlan: buildDefaultFloorPlan(synced.tables),
    settings: {
      managerSoundEnabled: true,
    },
  };
}

const DEFAULT_DATA = buildDefaultHallData();

function normalizeFloor(rawFloor: unknown, fallbackTables: HallTable[]): FloorPlan {
  const defaults = buildDefaultFloorPlan(fallbackTables);
  if (!rawFloor || typeof rawFloor !== "object") return defaults;

  const raw = rawFloor as Partial<FloorPlan>;

  const tables = Array.isArray(raw.tables)
    ? raw.tables
        .map((table) => ({
          tableId: Number(table.tableId),
          label: table.label ? String(table.label) : undefined,
          x: clampPercent(Number(table.x ?? 50)),
          y: clampPercent(Number(table.y ?? 50)),
          shape:
            table.shape === "round" || table.shape === "rect" || table.shape === "square"
              ? table.shape
              : "square",
        }))
        .filter((table) => Number.isFinite(table.tableId) && table.tableId > 0)
    : defaults.tables;

  const zones = Array.isArray(raw.zones)
    ? raw.zones
        .map((zone) => ({
          id: String(zone.id ?? ""),
          label: String(zone.label ?? ""),
          x: clampPercent(Number(zone.x ?? 20)),
          y: clampPercent(Number(zone.y ?? 20)),
          width: Math.max(8, Math.min(90, Number(zone.width ?? 20))),
          height: Math.max(8, Math.min(90, Number(zone.height ?? 20))),
        }))
        .filter((zone) => zone.id && zone.label)
    : defaults.zones;

  const nodeByTable = new Map<number, FloorTableNode>();
  for (const table of tables) {
    nodeByTable.set(table.tableId, table);
  }
  for (const table of fallbackTables) {
    if (!nodeByTable.has(table.tableId)) {
      const fallback = defaults.tables.find((node) => node.tableId === table.tableId);
      if (fallback) nodeByTable.set(table.tableId, fallback);
    }
  }

  return {
    tables: Array.from(nodeByTable.values()).sort((a, b) => a.tableId - b.tableId),
    zones,
  };
}

function normalizeHallData(input: unknown): HallData {
  if (!input || typeof input !== "object") return DEFAULT_DATA;
  const raw = input as Partial<HallData>;

  const waiters: WaiterProfile[] = Array.isArray(raw.waiters)
    ? raw.waiters
        .map((waiter) => ({
          id: String(waiter.id ?? ""),
          name: String(waiter.name ?? ""),
          login: String(waiter.login ?? ""),
          password: String(waiter.password ?? ""),
          active: waiter.active !== false,
          tableIds: Array.isArray(waiter.tableIds)
            ? waiter.tableIds
                .map((tableId) => Number(tableId))
                .filter((tableId) => Number.isFinite(tableId) && tableId > 0)
            : [],
        }))
        .filter((waiter) => waiter.id && waiter.name)
    : DEFAULT_DATA.waiters;

  const tables: HallTable[] = Array.isArray(raw.tables)
    ? raw.tables
        .map((table) => ({
          tableId: Number(table.tableId),
          status: isValidStatus(table.status) ? table.status : "occupied",
          assignedWaiterId: table.assignedWaiterId
            ? String(table.assignedWaiterId)
            : undefined,
          guestStartedAt: Number(table.guestStartedAt ?? Date.now()),
          doneCooldownUntil: table.doneCooldownUntil
            ? Number(table.doneCooldownUntil)
            : undefined,
        }))
        .filter((table) => Number.isFinite(table.tableId) && table.tableId > 0)
    : DEFAULT_DATA.tables;

  const requests: ServiceRequest[] = Array.isArray(raw.requests)
    ? raw.requests
        .map((request) => ({
          id: String(request.id ?? ""),
          tableId: Number(request.tableId),
          type: (request.type === "bill" ? "bill" : "waiter") as ServiceRequestType,
          reason: String(request.reason ?? ""),
          createdAt: Number(request.createdAt ?? Date.now()),
          acknowledgedAt: request.acknowledgedAt
            ? Number(request.acknowledgedAt)
            : undefined,
          acknowledgedBy: request.acknowledgedBy
            ? String(request.acknowledgedBy)
            : undefined,
          resolvedAt: request.resolvedAt ? Number(request.resolvedAt) : undefined,
        }))
        .filter((request) => request.id && Number.isFinite(request.tableId) && request.tableId > 0)
    : DEFAULT_DATA.requests;

  const billLines: BillLine[] = Array.isArray(raw.billLines)
    ? raw.billLines
        .map((line) => ({
          id: String(line.id ?? ""),
          tableId: Number(line.tableId),
          dishId: line.dishId ? String(line.dishId) : undefined,
          title: String(line.title ?? ""),
          qty: Math.max(1, Number(line.qty ?? 1)),
          price: Math.max(0, Number(line.price ?? 0)),
          source: (line.source === "guest" ? "guest" : "waiter") as BillLineSource,
          note: line.note ? String(line.note) : undefined,
          createdAt: Number(line.createdAt ?? Date.now()),
        }))
        .filter(
          (line) =>
            line.id &&
            Number.isFinite(line.tableId) &&
            line.tableId > 0 &&
            line.title.length > 0,
        )
    : DEFAULT_DATA.billLines;

  const notesByTable: Record<string, string> = {};
  if (raw.notesByTable && typeof raw.notesByTable === "object") {
    for (const [tableId, value] of Object.entries(raw.notesByTable)) {
      notesByTable[String(tableId)] = String(value ?? "");
    }
  } else {
    Object.assign(notesByTable, DEFAULT_DATA.notesByTable);
  }

  const synced = syncAssignments(waiters, tables);

  const floorPlan = normalizeFloor(raw.floorPlan, synced.tables);

  const settings: HallSettings = {
    managerSoundEnabled:
      typeof raw.settings?.managerSoundEnabled === "boolean"
        ? raw.settings.managerSoundEnabled
        : DEFAULT_DATA.settings.managerSoundEnabled,
  };

  return {
    waiters: synced.waiters,
    tables: synced.tables,
    requests,
    billLines,
    notesByTable,
    floorPlan,
    settings,
  };
}

export function readHallData(): HallData {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    return normalizeHallData(JSON.parse(raw));
  } catch {
    return DEFAULT_DATA;
  }
}

export function writeHallData(data: HallData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function useHallData() {
  const [data, setData] = useState<HallData>(DEFAULT_DATA);

  useEffect(() => {
    setData(readHallData());

    const sync = () => {
      setData(readHallData());
    };

    window.addEventListener("storage", sync);
    window.addEventListener(UPDATE_EVENT, sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(UPDATE_EVENT, sync as EventListener);
    };
  }, []);

  const updateData = useCallback((updater: (current: HallData) => HallData) => {
    const next = updater(readHallData());
    writeHallData(next);
    setData(next);
  }, []);

  const resetData = useCallback(() => {
    writeHallData(DEFAULT_DATA);
    setData(DEFAULT_DATA);
  }, []);

  return useMemo(() => ({ data, updateData, resetData }), [data, resetData, updateData]);
}

export function formatDurationFrom(startMs: number, nowMs: number = Date.now()) {
  const diff = Math.max(0, nowMs - startMs);
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatMinutesAgo(timeMs: number, nowMs: number = Date.now()) {
  const diff = Math.max(0, nowMs - timeMs);
  const minutes = Math.max(1, Math.floor(diff / 60000));
  return `${minutes} мин назад`;
}
