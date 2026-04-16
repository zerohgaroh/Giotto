import { EventEmitter } from "events";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_RESTAURANT_PROFILE, DISHES, MENU_CATEGORIES } from "@/lib/menu-data";
import { WAITER_SEED_ACCOUNTS } from "@/lib/waiter-data";
import type { RestaurantData } from "@/lib/types";

type ServiceTableStatus = "free" | "occupied" | "waiting" | "ordered" | "bill";
type ServiceRequestType = "waiter" | "bill";
type BillLineSource = "guest" | "waiter";
type FloorTableShape = "square" | "round" | "rect";

type WaiterProfile = {
  id: string;
  name: string;
  login: string;
  password: string;
  active: boolean;
  tableIds: number[];
};

type HallTable = {
  tableId: number;
  status: ServiceTableStatus;
  assignedWaiterId?: string;
  guestStartedAt: number;
  doneCooldownUntil?: number;
};

type ServiceRequest = {
  id: string;
  tableId: number;
  type: ServiceRequestType;
  reason: string;
  createdAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
};

type BillLine = {
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

type FloorTableNode = {
  tableId: number;
  label?: string;
  x: number;
  y: number;
  shape: FloorTableShape;
};

type FloorZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloorPlan = {
  tables: FloorTableNode[];
  zones: FloorZone[];
};

type HallSettings = {
  managerSoundEnabled: boolean;
};

type HallData = {
  waiters: WaiterProfile[];
  tables: HallTable[];
  requests: ServiceRequest[];
  billLines: BillLine[];
  notesByTable: Record<string, string>;
  floorPlan: FloorPlan;
  settings: HallSettings;
};

type PersistedState = {
  revision: number;
  updatedAt: number;
  hall: HallData;
  restaurant: RestaurantData;
};

type StateEvent = {
  type: "hall:updated" | "restaurant:updated" | "state:reset";
  revision: number;
  updatedAt: number;
};

const STATE_FILE = path.join(process.cwd(), ".runtime", "giotto-state.json");

declare global {
  // eslint-disable-next-line no-var
  var __giottoStateEmitter: EventEmitter | undefined;
}

const stateEmitter = globalThis.__giottoStateEmitter ?? new EventEmitter();
if (!globalThis.__giottoStateEmitter) {
  globalThis.__giottoStateEmitter = stateEmitter;
}

let writeChain: Promise<void> = Promise.resolve();

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
    { id: "zone-main", label: "Основной зал", x: 8, y: 8, width: 62, height: 56 },
    { id: "zone-terrace", label: "Терраса", x: 72, y: 12, width: 22, height: 36 },
  ];

  return { tables: tablesNodes, zones };
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
    for (const tableId of waiter.tableIds) tableAssignments.set(tableId, waiter.id);
  }

  const tables: HallTable[] = Array.from({ length: 20 }, (_, index) => {
    const tableId = index + 1;
    const assignedWaiterId = tableAssignments.get(tableId);

    if (tableId === 3) return { tableId, assignedWaiterId, status: "waiting", guestStartedAt: now - 42 * 60_000 };
    if (tableId === 5) return { tableId, assignedWaiterId, status: "bill", guestStartedAt: now - 71 * 60_000 };
    if (tableId === 7) return { tableId, assignedWaiterId, status: "ordered", guestStartedAt: now - 27 * 60_000 };
    if (tableId <= 12) {
      return {
        tableId,
        assignedWaiterId,
        status: "occupied",
        guestStartedAt: now - (14 + tableId * 2) * 60_000,
      };
    }

    return { tableId, assignedWaiterId, status: "free", guestStartedAt: now };
  });

  return {
    waiters,
    tables,
    requests: [
      {
        id: "rq-w-3",
        tableId: 3,
        type: "waiter",
        reason: "Вопрос по блюду",
        createdAt: now - 3 * 60_000,
      },
      {
        id: "rq-b-5",
        tableId: 5,
        type: "bill",
        reason: "Гости готовы оплатить",
        createdAt: now - 2 * 60_000,
      },
    ],
    billLines: [
      {
        id: "line-3-1",
        tableId: 3,
        title: "Tagliatelle al tartufo",
        dishId: "tagliatelle",
        qty: 1,
        price: 198000,
        source: "guest",
        note: "Прожарка: medium rare",
        createdAt: now - 24 * 60_000,
      },
      {
        id: "line-3-2",
        tableId: 3,
        title: "Acqua Panna",
        qty: 2,
        price: 28000,
        source: "waiter",
        createdAt: now - 10 * 60_000,
      },
      {
        id: "line-5-1",
        tableId: 5,
        title: "Risotto ai funghi",
        dishId: "risotto",
        qty: 2,
        price: 132000,
        source: "guest",
        createdAt: now - 38 * 60_000,
      },
    ],
    notesByTable: {
      "3": "Аллергия на орехи",
      "5": "Гости празднуют день рождения",
    },
    floorPlan: buildDefaultFloorPlan(tables),
    settings: { managerSoundEnabled: true },
  };
}

function buildDefaultRestaurantData(): RestaurantData {
  return {
    profile: DEFAULT_RESTAURANT_PROFILE,
    categories: MENU_CATEGORIES,
    dishes: DISHES,
  };
}

function buildDefaultState(): PersistedState {
  return {
    revision: 1,
    updatedAt: Date.now(),
    hall: buildDefaultHallData(),
    restaurant: buildDefaultRestaurantData(),
  };
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    const state = buildDefaultState();
    await fs.writeFile(STATE_FILE, JSON.stringify(state), "utf-8");
  }
}

async function readState(): Promise<PersistedState> {
  await ensureFile();
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== "object" || !parsed.hall || !parsed.restaurant) {
      const fallback = buildDefaultState();
      await fs.writeFile(STATE_FILE, JSON.stringify(fallback), "utf-8");
      return fallback;
    }
    return {
      revision: Number(parsed.revision ?? 1),
      updatedAt: Number(parsed.updatedAt ?? Date.now()),
      hall: parsed.hall as HallData,
      restaurant: parsed.restaurant as RestaurantData,
    };
  } catch {
    const fallback = buildDefaultState();
    await fs.writeFile(STATE_FILE, JSON.stringify(fallback), "utf-8");
    return fallback;
  }
}

async function withWriteLock(task: () => Promise<void>): Promise<void> {
  writeChain = writeChain.then(task, task);
  await writeChain;
}

async function writeState(next: PersistedState): Promise<void> {
  await withWriteLock(async () => {
    await ensureFile();
    await fs.writeFile(STATE_FILE, JSON.stringify(next), "utf-8");
  });
}

function publish(type: StateEvent["type"], revision: number) {
  stateEmitter.emit("state-event", {
    type,
    revision,
    updatedAt: Date.now(),
  } satisfies StateEvent);
}

export async function getHallData(): Promise<HallData> {
  const state = await readState();
  return state.hall;
}

export async function setHallData(nextHall: HallData): Promise<HallData> {
  const state = await readState();
  const next: PersistedState = {
    ...state,
    hall: nextHall,
    revision: state.revision + 1,
    updatedAt: Date.now(),
  };
  await writeState(next);
  publish("hall:updated", next.revision);
  return next.hall;
}

export async function resetHallData(): Promise<HallData> {
  const state = await readState();
  const next: PersistedState = {
    ...state,
    hall: buildDefaultHallData(),
    revision: state.revision + 1,
    updatedAt: Date.now(),
  };
  await writeState(next);
  publish("state:reset", next.revision);
  return next.hall;
}

export async function getRestaurantData(): Promise<RestaurantData> {
  const state = await readState();
  return state.restaurant;
}

export async function setRestaurantData(nextRestaurant: RestaurantData): Promise<RestaurantData> {
  const state = await readState();
  const next: PersistedState = {
    ...state,
    restaurant: nextRestaurant,
    revision: state.revision + 1,
    updatedAt: Date.now(),
  };
  await writeState(next);
  publish("restaurant:updated", next.revision);
  return next.restaurant;
}

export function subscribeStateEvents(listener: (event: StateEvent) => void): () => void {
  stateEmitter.on("state-event", listener);
  return () => {
    stateEmitter.off("state-event", listener);
  };
}
