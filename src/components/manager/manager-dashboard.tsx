"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  BellRing,
  Check,
  History,
  LayoutDashboard,
  LogOut,
  MapIcon,
  PencilLine,
  PlusCircle,
  Save,
  Trash2,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRestaurantData } from "@/lib/restaurant-store";
import type { Dish, MenuCategoryId } from "@/lib/types";
import {
  formatDurationFrom,
  formatMinutesAgo,
  type FloorPlan,
  type FloorTableShape,
  type HallData,
  type HallTable,
  type ServiceRequestType,
  type WaiterProfile,
  useHallData,
} from "@/lib/service-store";
import { REQUEST_META, STATUS_META } from "../waiter/waiter-ui";

type ViewId = "hall" | "floor" | "waiters" | "menu";

type DishEditorState = {
  id?: string;
  nameRu: string;
  nameIt: string;
  description: string;
  price: string;
  portion: string;
  energyKcal: string;
  category: string;
  available: boolean;
  image: string;
};

type WaiterEditorState = {
  id?: string;
  name: string;
  login: string;
  password: string;
  active: boolean;
  tableIds: number[];
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=85";

function formatUzs(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " UZS";
}

function emptyDish(categoryId: string): DishEditorState {
  return {
    nameRu: "",
    nameIt: "",
    description: "",
    price: "",
    portion: "250 г",
    energyKcal: "0",
    category: categoryId,
    available: true,
    image: PLACEHOLDER_IMAGE,
  };
}

function toDishEditor(dish: Dish): DishEditorState {
  return {
    id: dish.id,
    nameRu: dish.nameRu,
    nameIt: dish.nameIt,
    description: dish.description,
    price: String(dish.price),
    portion: dish.portion,
    energyKcal: String(dish.energyKcal),
    category: dish.category,
    available: dish.available !== false,
    image: dish.image,
  };
}

function emptyWaiterEditor(): WaiterEditorState {
  return {
    name: "",
    login: "",
    password: "",
    active: true,
    tableIds: [],
  };
}

function toWaiterEditor(waiter: WaiterProfile): WaiterEditorState {
  return {
    id: waiter.id,
    name: waiter.name,
    login: waiter.login,
    password: waiter.password,
    active: waiter.active,
    tableIds: waiter.tableIds,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function syncWaiterTables(waiters: WaiterProfile[], tables: HallTable[]): WaiterProfile[] {
  const byWaiter = new Map<string, number[]>();
  for (const table of tables) {
    if (!table.assignedWaiterId) continue;
    const list = byWaiter.get(table.assignedWaiterId) ?? [];
    list.push(table.tableId);
    byWaiter.set(table.assignedWaiterId, list);
  }
  return waiters.map((waiter) => ({
    ...waiter,
    tableIds: (byWaiter.get(waiter.id) ?? []).sort((a, b) => a - b),
  }));
}

function shapeClass(shape: FloorTableShape) {
  if (shape === "round") return "rounded-full";
  if (shape === "rect") return "rounded-[0.7rem]";
  return "rounded-[0.35rem]";
}

function playSoftSignal() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 680;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.065, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.27);

    window.setTimeout(() => {
      void ctx.close();
    }, 360);
  } catch {
    // ignore audio errors
  }
}

export function ManagerDashboard() {
  const { data: restaurantData, updateData: updateRestaurantData } = useRestaurantData();
  const { data: hallData, updateData: updateHallData, resetData: resetHallData } = useHallData();

  const [activeView, setActiveView] = useState<ViewId>("hall");
  const [now, setNow] = useState(() => Date.now());
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyWaiter, setHistoryWaiter] = useState("all");
  const [historyTable, setHistoryTable] = useState("all");
  const [historyType, setHistoryType] = useState<"all" | ServiceRequestType>("all");

  const [waiterEditor, setWaiterEditor] = useState<WaiterEditorState>(emptyWaiterEditor);
  const [waiterEditorOpen, setWaiterEditorOpen] = useState(false);

  const [dishEditor, setDishEditor] = useState<DishEditorState>(() =>
    emptyDish(restaurantData.categories[0]?.id ?? "antipasti"),
  );
  const [dishEditorOpen, setDishEditorOpen] = useState(false);
  const [dishEditorMode, setDishEditorMode] = useState<"create" | "edit">("create");
  const [menuFilter, setMenuFilter] = useState<"all" | MenuCategoryId>("all");

  const [floorDraft, setFloorDraft] = useState<FloorPlan>(hallData.floorPlan);
  const [floorDirty, setFloorDirty] = useState(false);
  const floorRef = useRef<HTMLDivElement | null>(null);
  const [selectedFloorTable, setSelectedFloorTable] = useState<number | null>(null);
  const [draggingTable, setDraggingTable] = useState<{
    tableId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const previousActiveRequestIds = useRef<string[]>([]);
  const [shakingTableIds, setShakingTableIds] = useState<number[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (floorDirty) return;
    setFloorDraft(hallData.floorPlan);
  }, [floorDirty, hallData.floorPlan]);

  const unresolvedRequests = useMemo(
    () => hallData.requests.filter((request) => !request.resolvedAt),
    [hallData.requests],
  );

  useEffect(() => {
    const currentIds = unresolvedRequests.map((request) => request.id);
    const nextOnes = unresolvedRequests.filter(
      (request) => !previousActiveRequestIds.current.includes(request.id),
    );

    if (nextOnes.length > 0) {
      const newTableIds = Array.from(new Set(nextOnes.map((request) => request.tableId)));
      setShakingTableIds((current) => Array.from(new Set([...current, ...newTableIds])));
      window.setTimeout(() => {
        setShakingTableIds((current) => current.filter((tableId) => !newTableIds.includes(tableId)));
      }, 2100);

      if (hallData.settings.managerSoundEnabled) {
        playSoftSignal();
      }
    }

    previousActiveRequestIds.current = currentIds;
  }, [hallData.settings.managerSoundEnabled, unresolvedRequests]);

  const tables = useMemo(
    () => [...hallData.tables].sort((a, b) => a.tableId - b.tableId),
    [hallData.tables],
  );

  const occupiedCount = tables.filter((table) => table.status !== "free").length;

  const selectedTable = useMemo(
    () => tables.find((table) => table.tableId === selectedTableId),
    [selectedTableId, tables],
  );

  const selectedTableRequests = useMemo(
    () =>
      hallData.requests
        .filter((request) => request.tableId === selectedTableId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [hallData.requests, selectedTableId],
  );

  const selectedTableBill = useMemo(
    () =>
      hallData.billLines
        .filter((line) => line.tableId === selectedTableId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [hallData.billLines, selectedTableId],
  );

  const selectedTableTotal = selectedTableBill.reduce(
    (sum, line) => sum + line.qty * line.price,
    0,
  );

  const resolvedRequests = useMemo(
    () => hallData.requests.filter((request) => !!request.resolvedAt),
    [hallData.requests],
  );

  const filteredHistory = useMemo(
    () =>
      hallData.requests
        .filter((request) => {
          if (historyWaiter !== "all" && request.acknowledgedBy !== historyWaiter) return false;
          if (historyTable !== "all" && String(request.tableId) !== historyTable) return false;
          if (historyType !== "all" && request.type !== historyType) return false;
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [hallData.requests, historyTable, historyType, historyWaiter],
  );

  const filteredMenu = useMemo(() => {
    if (menuFilter === "all") return restaurantData.dishes;
    return restaurantData.dishes.filter((dish) => dish.category === menuFilter);
  }, [menuFilter, restaurantData.dishes]);

  const averageResponseMinutes = useMemo(() => {
    const values = resolvedRequests
      .filter((request) => request.acknowledgedAt)
      .map((request) => (request.acknowledgedAt! - request.createdAt) / 60000);
    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [resolvedRequests]);

  function updateAssignments(
    updater: (current: HallData) => { waiters: WaiterProfile[]; tables: HallTable[] },
  ) {
    updateHallData((current) => {
      const next = updater(current);
      return {
        ...current,
        waiters: syncWaiterTables(next.waiters, next.tables),
        tables: next.tables,
      };
    });
  }

  function saveWaiterEditor() {
    const name = waiterEditor.name.trim();
    const login = waiterEditor.login.trim();
    const password = waiterEditor.password.trim();
    if (!name || !login || !password) return;

    updateAssignments((current) => {
      const tableSet = new Set(waiterEditor.tableIds);
      const waiterId = waiterEditor.id ?? `w-${slugify(name) || "new"}-${Date.now()}`;

      const baseWaiters = waiterEditor.id
        ? current.waiters.map((waiter) =>
            waiter.id === waiterEditor.id
              ? {
                  ...waiter,
                  name,
                  login,
                  password,
                  active: waiterEditor.active,
                }
              : waiter,
          )
        : [
            ...current.waiters,
            {
              id: waiterId,
              name,
              login,
              password,
              active: waiterEditor.active,
              tableIds: [],
            },
          ];

      const tables = current.tables.map((table) => {
        if (tableSet.has(table.tableId)) {
          return { ...table, assignedWaiterId: waiterId };
        }
        if (table.assignedWaiterId === waiterId) {
          return { ...table, assignedWaiterId: undefined };
        }
        return table;
      });

      return {
        waiters: baseWaiters,
        tables,
      };
    });

    setWaiterEditor(emptyWaiterEditor());
    setWaiterEditorOpen(false);
  }

  function assignTable(tableId: number, waiterId: string | undefined) {
    updateAssignments((current) => {
      const tables = current.tables.map((table) =>
        table.tableId === tableId ? { ...table, assignedWaiterId: waiterId } : table,
      );
      return { waiters: current.waiters, tables };
    });
  }

  function saveDishEditor() {
    const nameRu = dishEditor.nameRu.trim();
    if (!nameRu || !dishEditor.category.trim()) return;

    const nextDish: Dish = {
      id:
        dishEditor.id ??
        `${nameRu.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-")}-${Date.now()}`,
      category: dishEditor.category,
      nameRu,
      nameIt: dishEditor.nameIt.trim() || nameRu,
      description: dishEditor.description.trim() || "Описание добавит менеджер позже.",
      price: Math.max(Number(dishEditor.price) || 0, 0),
      image: dishEditor.image.trim() || PLACEHOLDER_IMAGE,
      portion: dishEditor.portion.trim() || "250 г",
      energyKcal: Math.max(Number(dishEditor.energyKcal) || 0, 0),
      available: dishEditor.available,
      badgeTone: "gold",
      highlight: false,
    };

    updateRestaurantData((current) => {
      if (dishEditorMode === "edit" && dishEditor.id) {
        return {
          ...current,
          dishes: current.dishes.map((dish) => (dish.id === dishEditor.id ? nextDish : dish)),
        };
      }
      return {
        ...current,
        dishes: [nextDish, ...current.dishes],
      };
    });

    setDishEditorOpen(false);
  }

  const navItems: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
    { id: "hall", label: "Зал", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { id: "floor", label: "Схема зала", icon: <MapIcon className="h-4.5 w-4.5" /> },
    { id: "waiters", label: "Официанты", icon: <Users className="h-4.5 w-4.5" /> },
    { id: "menu", label: "Меню", icon: <UtensilsCrossed className="h-4.5 w-4.5" /> },
  ];

  return (
    <main className="motion-page mx-auto w-full max-w-[1380px] px-4 py-4 sm:px-6">
      <div className="motion-surface overflow-hidden rounded-[28px] border border-giotto-line bg-white/95 shadow-[0_18px_48px_rgba(8,29,54,0.08)]">
        <header className="flex flex-wrap items-center gap-2 border-b border-giotto-line px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-giotto-muted">Giotto Manager</p>
            <h1 className="truncate font-serif text-[2rem] leading-none text-giotto-navy-deep">Зал</h1>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="motion-action inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1.5 text-xs font-medium text-giotto-ink"
          >
            <History className="h-3.5 w-3.5" />
            История
          </button>

          <button
            type="button"
            onClick={() =>
              updateHallData((current) => ({
                ...current,
                settings: {
                  ...current.settings,
                  managerSoundEnabled: !current.settings.managerSoundEnabled,
                },
              }))
            }
            className="motion-action inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1.5 text-xs font-medium text-giotto-ink"
          >
            {hallData.settings.managerSoundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            Звук
          </button>

          <Link
            href="/manager/logout"
            className="motion-action inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1.5 text-xs font-medium text-giotto-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти
          </Link>
        </header>

        <div className="grid min-h-[calc(100dvh-180px)] lg:grid-cols-[220px_1fr]">
          <aside className="border-b border-giotto-line bg-giotto-cream/45 p-3 lg:border-b-0 lg:border-r">
            <nav className="grid gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={clsx(
                    "motion-action flex items-center gap-2 rounded-giotto px-3 py-2 text-left text-sm",
                    activeView === item.id
                      ? "bg-white text-giotto-navy-deep shadow-[0_3px_12px_rgba(8,29,54,0.08)]"
                      : "text-giotto-muted hover:bg-white/70",
                  )}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            {activeView === "hall" ? (
              <div className="divide-y divide-giotto-line">
                <section className="px-4 py-4 sm:px-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Kpi title="Занято столов" value={`${occupiedCount}/${tables.length}`} subtitle="Текущая загрузка" />
                    <Kpi title="Активные вызовы" value={String(unresolvedRequests.length)} subtitle="Реальное время" />
                    <Kpi title="Средняя реакция" value={`${averageResponseMinutes || 0} мин`} subtitle="По закрытым вызовам" />
                    <Kpi title="Время" value={new Date(now).toLocaleTimeString("ru-RU")} subtitle="Текущий момент" />
                  </div>
                </section>

                <section className="px-4 py-4 sm:px-6">
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {tables.map((table) => {
                      const waiter = table.assignedWaiterId
                        ? hallData.waiters.find((item) => item.id === table.assignedWaiterId)
                        : undefined;
                      const request = unresolvedRequests.find((item) => item.tableId === table.tableId);
                      const highlighted = table.status === "waiting" || table.status === "bill";

                      return (
                        <button
                          key={table.tableId}
                          type="button"
                          onClick={() => setSelectedTableId(table.tableId)}
                          className={clsx(
                            "motion-action motion-surface rounded-[1rem] bg-[#FAF7F2] px-3 py-3 text-left",
                            highlighted ? "border-2 border-[#C8A96E]" : "border border-[#D4D1CB]",
                            shakingTableIds.includes(table.tableId)
                              ? "animate-[giotto-manager-shake_0.6s_ease-in-out_3]"
                              : "",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-semibold text-giotto-navy-deep">Стол {table.tableId}</p>
                            <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_META[table.status].className)}>
                              {STATUS_META[table.status].label}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-giotto-muted">
                            👤 {waiter?.name ?? "Без официанта"}
                          </p>
                          <p className="mt-0.5 font-mono text-[12px] font-semibold text-giotto-navy-deep">
                            ⏱ {formatDurationFrom(table.guestStartedAt, now)}
                          </p>
                          {request ? (
                            <p className="mt-2 flex items-center gap-1 rounded-md bg-[#FFF7EA] px-2 py-1 text-[11px] text-[#8A6A33]">
                              <BellRing className="h-3.5 w-3.5" strokeWidth={1.7} />
                              Вызов: {request.reason} · {new Date(request.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {selectedTable ? (
                  <section className="px-4 py-4 sm:px-6">
                    <div className="motion-surface rounded-[1.2rem] border border-giotto-line bg-white p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-[1.6rem] leading-none text-giotto-navy-deep">
                          Стол {selectedTable.tableId}
                        </h2>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_META[selectedTable.status].className)}>
                          {STATUS_META[selectedTable.status].label}
                        </span>
                        <span className="ml-auto font-mono text-sm text-giotto-navy-deep">
                          {formatDurationFrom(selectedTable.guestStartedAt, now)}
                        </span>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-giotto-muted">Назначенный официант</p>
                            <select
                              value={selectedTable.assignedWaiterId ?? ""}
                              onChange={(event) =>
                                assignTable(
                                  selectedTable.tableId,
                                  event.target.value || undefined,
                                )
                              }
                              className="motion-action mt-1 h-10 w-full rounded-md border border-giotto-line px-2 text-sm outline-none focus:border-giotto-navy"
                            >
                              <option value="">Без официанта</option>
                              {hallData.waiters.map((waiter) => (
                                <option key={waiter.id} value={waiter.id}>
                                  {waiter.name}{waiter.active ? "" : " (деактивирован)"}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-giotto-navy-deep">Активные вызовы</p>
                            <div className="mt-2 space-y-2">
                              {selectedTableRequests
                                .filter((request) => !request.resolvedAt)
                                .map((request) => (
                                  <div key={request.id} className="rounded-md border border-[#E8D6B5] bg-[#FFF8EC] px-3 py-2">
                                    <p className="text-xs font-semibold text-[#8A6A33]">
                                      {REQUEST_META[request.type].title}
                                    </p>
                                    <p className="text-xs text-giotto-muted">{request.reason}</p>
                                    <p className="text-[11px] text-giotto-muted">{formatMinutesAgo(request.createdAt, now)}</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const doneAt = Date.now();
                                        updateHallData((current) => ({
                                          ...current,
                                          requests: current.requests.map((candidate) =>
                                            candidate.id === request.id
                                              ? {
                                                  ...candidate,
                                                  acknowledgedAt: doneAt,
                                                  acknowledgedBy: selectedTable.assignedWaiterId,
                                                  resolvedAt: doneAt,
                                                }
                                              : candidate,
                                          ),
                                          tables: current.tables.map((candidate) =>
                                            candidate.tableId === selectedTable.tableId
                                              ? { ...candidate, status: "occupied" }
                                              : candidate,
                                          ),
                                        }));
                                      }}
                                      className="motion-action mt-1.5 inline-flex items-center gap-1 rounded-md border border-giotto-line px-2 py-1 text-[11px]"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Закрыть как принято
                                    </button>
                                  </div>
                                ))}
                              {selectedTableRequests.filter((request) => !request.resolvedAt).length === 0 ? (
                                <p className="text-xs text-giotto-muted">Активных вызовов нет.</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-giotto-navy-deep">Счёт стола</p>
                            <div className="mt-2 space-y-1.5">
                              {selectedTableBill.map((line) => (
                                <div key={line.id} className="rounded-md border border-giotto-line px-2 py-1.5 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span>{line.title} × {line.qty}</span>
                                    <span className="font-semibold">{formatUzs(line.qty * line.price)}</span>
                                  </div>
                                  <p className="text-[11px] text-giotto-muted">{line.source === "guest" ? "от гостя" : "добавил официант"}</p>
                                </div>
                              ))}
                              {selectedTableBill.length === 0 ? (
                                <p className="text-xs text-giotto-muted">Позиции пока отсутствуют.</p>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-giotto-navy-deep">Итого: {formatUzs(selectedTableTotal)}</p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-giotto-navy-deep">История вызовов</p>
                            <div className="mt-2 space-y-1.5">
                              {selectedTableRequests.map((request) => (
                                <div key={request.id} className="rounded-md border border-giotto-line px-2 py-1.5 text-xs">
                                  <p className="font-medium">{REQUEST_META[request.type].title}</p>
                                  <p className="text-giotto-muted">
                                    {new Date(request.createdAt).toLocaleTimeString("ru-RU", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {request.acknowledgedAt
                                      ? ` · Реакция ${Math.max(1, Math.round((request.acknowledgedAt - request.createdAt) / 60000))} мин`
                                      : " · В обработке"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const doneAt = Date.now();
                          updateHallData((current) => ({
                            ...current,
                            tables: current.tables.map((table) =>
                              table.tableId === selectedTable.tableId
                                ? {
                                    ...table,
                                    status: "free",
                                    guestStartedAt: doneAt,
                                    doneCooldownUntil: undefined,
                                  }
                                : table,
                            ),
                            requests: current.requests.map((request) =>
                              request.tableId === selectedTable.tableId && !request.resolvedAt
                                ? { ...request, resolvedAt: doneAt }
                                : request,
                            ),
                            billLines: current.billLines.filter(
                              (line) => line.tableId !== selectedTable.tableId,
                            ),
                            notesByTable: Object.fromEntries(
                              Object.entries(current.notesByTable).filter(
                                ([tableId]) => Number(tableId) !== selectedTable.tableId,
                              ),
                            ),
                          }));
                        }}
                        className="motion-action mt-4 inline-flex items-center gap-1 rounded-md bg-giotto-navy px-3 py-2 text-xs font-semibold text-white"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Освободить стол
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {activeView === "floor" ? (
              <div className="px-4 py-4 sm:px-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-giotto-navy-deep">Конструктор зала</p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextId = Math.max(0, ...hallData.tables.map((table) => table.tableId)) + 1;
                      updateHallData((current) => ({
                        ...current,
                        tables: [
                          ...current.tables,
                          {
                            tableId: nextId,
                            status: "free",
                            guestStartedAt: Date.now(),
                          },
                        ],
                        floorPlan: {
                          ...current.floorPlan,
                          tables: [
                            ...current.floorPlan.tables,
                            { tableId: nextId, label: `Стол ${nextId}`, x: 18, y: 18, shape: "square" },
                          ],
                        },
                      }));
                    }}
                    className="motion-action inline-flex items-center gap-1 rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Добавить стол
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `zone-${Date.now()}`;
                      setFloorDirty(true);
                      setFloorDraft((current) => ({
                        ...current,
                        zones: [
                          ...current.zones,
                          { id, label: "Новая зона", x: 20, y: 20, width: 26, height: 18 },
                        ],
                      }));
                    }}
                    className="motion-action inline-flex items-center gap-1 rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Добавить зону
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateHallData((current) => ({
                        ...current,
                        floorPlan: floorDraft,
                      }));
                      setFloorDirty(false);
                    }}
                    className={clsx(
                      "motion-action ml-auto inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium",
                      floorDirty
                        ? "bg-giotto-navy text-white"
                        : "border border-giotto-line text-giotto-muted",
                    )}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Сохранить схему
                  </button>
                </div>

                <div
                  ref={floorRef}
                  className="relative min-h-[520px] overflow-hidden rounded-giotto-xl border border-giotto-line bg-[radial-gradient(circle,#d4d1cb_0.9px,transparent_1px)] [background-size:18px_18px]"
                  onPointerMove={(event) => {
                    if (!draggingTable || !floorRef.current) return;
                    const rect = floorRef.current.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * 100 - draggingTable.offsetX;
                    const y = ((event.clientY - rect.top) / rect.height) * 100 - draggingTable.offsetY;
                    setFloorDirty(true);
                    setFloorDraft((current) => ({
                      ...current,
                      tables: current.tables.map((table) =>
                        table.tableId === draggingTable.tableId
                          ? {
                              ...table,
                              x: Math.min(96, Math.max(4, x)),
                              y: Math.min(96, Math.max(4, y)),
                            }
                          : table,
                      ),
                    }));
                  }}
                  onPointerUp={() => setDraggingTable(null)}
                  onPointerLeave={() => setDraggingTable(null)}
                >
                  {floorDraft.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="absolute rounded-lg border border-[#d9d3c8] bg-[#fffaf2]/70 px-2 py-1"
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <input
                        value={zone.label}
                        onChange={(event) => {
                          const label = event.target.value;
                          setFloorDirty(true);
                          setFloorDraft((current) => ({
                            ...current,
                            zones: current.zones.map((item) =>
                              item.id === zone.id ? { ...item, label } : item,
                            ),
                          }));
                        }}
                        className="motion-action w-full border-0 bg-transparent text-[11px] font-medium text-giotto-muted outline-none"
                      />
                    </div>
                  ))}

                  {floorDraft.tables.map((node) => {
                    const table = hallData.tables.find((item) => item.tableId === node.tableId);
                    const status = table?.status ?? "free";
                    const hasCall = status === "waiting" || status === "bill";
                    return (
                      <button
                        key={node.tableId}
                        type="button"
                        onPointerDown={(event) => {
                          if (!floorRef.current) return;
                          const rect = floorRef.current.getBoundingClientRect();
                          const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
                          const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
                          setDraggingTable({
                            tableId: node.tableId,
                            offsetX: pointerX - node.x,
                            offsetY: pointerY - node.y,
                          });
                        }}
                        onClick={() => setSelectedFloorTable(node.tableId)}
                        className={clsx(
                          "motion-action absolute flex h-11 w-11 items-center justify-center border text-xs font-semibold shadow-sm",
                          shapeClass(node.shape),
                          STATUS_META[status].className,
                          hasCall ? "border-[#C8A96E]" : "border-white/70",
                          selectedFloorTable === node.tableId ? "ring-2 ring-giotto-navy/40" : "",
                          hasCall ? "animate-[giotto-manager-shake_0.6s_ease-in-out_3]" : "",
                        )}
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {node.tableId}
                      </button>
                    );
                  })}
                </div>

                {selectedFloorTable ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-giotto border border-giotto-line bg-giotto-cream/45 px-3 py-2 text-xs">
                    <span>Выбран стол #{selectedFloorTable}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFloorDirty(true);
                        setFloorDraft((current) => ({
                          ...current,
                          tables: current.tables.filter(
                            (table) => table.tableId !== selectedFloorTable,
                          ),
                        }));
                        updateHallData((current) => ({
                          ...current,
                          tables: current.tables.filter((table) => table.tableId !== selectedFloorTable),
                          billLines: current.billLines.filter((line) => line.tableId !== selectedFloorTable),
                          requests: current.requests.filter((request) => request.tableId !== selectedFloorTable),
                        }));
                        setSelectedFloorTable(null);
                      }}
                      className="motion-action inline-flex items-center gap-1 rounded-md border border-[#A32D2D]/30 px-2 py-1 text-[#A32D2D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить стол
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeView === "waiters" ? (
              <div className="px-4 py-4 sm:px-6">
                <div className="mb-3 flex items-center gap-2">
                  <p className="text-sm font-semibold text-giotto-navy-deep">Официанты</p>
                  <button
                    type="button"
                    onClick={() => {
                      setWaiterEditor(emptyWaiterEditor());
                      setWaiterEditorOpen(true);
                    }}
                    className="motion-action ml-auto inline-flex items-center gap-1 rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Добавить официанта
                  </button>
                </div>

                <div className="space-y-2">
                  {hallData.waiters.map((waiter) => (
                    <div key={waiter.id} className="motion-surface rounded-giotto border border-giotto-line bg-white px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-giotto-navy-deep">{waiter.name}</p>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            waiter.active
                              ? "bg-[#EAF3DE] text-[#2D6A4F]"
                              : "bg-[#FCEBEB] text-[#A32D2D]",
                          )}
                        >
                          {waiter.active ? "Активен" : "Неактивен"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setWaiterEditor(toWaiterEditor(waiter));
                            setWaiterEditorOpen(true);
                          }}
                          className="motion-action ml-auto inline-flex items-center gap-1 rounded-md border border-giotto-line px-2 py-1 text-xs"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Изменить
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-giotto-muted">
                        Логин: {waiter.login} · Столы: {waiter.tableIds.length ? waiter.tableIds.join(", ") : "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {waiterEditorOpen ? (
                  <div className="motion-surface mt-4 rounded-giotto-xl border border-giotto-line bg-giotto-cream/35 p-3">
                    <p className="text-xs font-semibold text-giotto-navy-deep">
                      {waiterEditor.id ? "Редактировать официанта" : "Добавить официанта"}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Field
                        label="Имя"
                        value={waiterEditor.name}
                        onChange={(value) => setWaiterEditor((current) => ({ ...current, name: value }))}
                      />
                      <Field
                        label="Логин"
                        value={waiterEditor.login}
                        onChange={(value) => setWaiterEditor((current) => ({ ...current, login: value }))}
                      />
                      <Field
                        label="Пароль"
                        value={waiterEditor.password}
                        onChange={(value) => setWaiterEditor((current) => ({ ...current, password: value }))}
                      />
                      <label className="grid gap-1 text-xs text-giotto-muted">
                        <span>Статус</span>
                        <label className="inline-flex h-10 items-center gap-2 rounded-md border border-giotto-line bg-white px-2 text-sm text-giotto-ink">
                          <input
                            type="checkbox"
                            checked={waiterEditor.active}
                            onChange={(event) =>
                              setWaiterEditor((current) => ({
                                ...current,
                                active: event.target.checked,
                              }))
                            }
                          />
                          Активен
                        </label>
                      </label>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-giotto-muted">Назначить столы (только одному официанту)</p>
                      <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {tables.map((table) => {
                          const checked = waiterEditor.tableIds.includes(table.tableId);
                          return (
                            <button
                              key={table.tableId}
                              type="button"
                              onClick={() =>
                                setWaiterEditor((current) => ({
                                  ...current,
                                  tableIds: checked
                                    ? current.tableIds.filter((tableId) => tableId !== table.tableId)
                                    : [...current.tableIds, table.tableId],
                                }))
                              }
                              className={clsx(
                                "motion-action rounded-md border px-2 py-1 text-xs",
                                checked
                                  ? "border-giotto-navy bg-giotto-navy text-white"
                                  : "border-giotto-line bg-white text-giotto-muted",
                              )}
                            >
                              {table.tableId}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={saveWaiterEditor}
                        className="motion-action inline-flex items-center gap-1 rounded-md bg-giotto-navy px-3 py-1.5 text-xs font-medium text-white"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWaiterEditor(emptyWaiterEditor());
                          setWaiterEditorOpen(false);
                        }}
                        className="motion-action rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeView === "menu" ? (
              <div className="divide-y divide-giotto-line">
                <section className="px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-giotto-navy-deep">Управление меню</p>
                    <button
                      type="button"
                      onClick={() => {
                        setDishEditorMode("create");
                        setDishEditor(emptyDish(restaurantData.categories[0]?.id ?? "antipasti"));
                        setDishEditorOpen(true);
                      }}
                      className="motion-action ml-auto inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1 text-xs"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Добавить блюдо
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMenuFilter("all")}
                      className={clsx(
                        "motion-action rounded-full border px-3 py-1 text-xs",
                        menuFilter === "all"
                          ? "border-giotto-navy bg-giotto-cream text-giotto-navy-deep"
                          : "border-giotto-line text-giotto-muted",
                      )}
                    >
                      Все
                    </button>
                    {restaurantData.categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setMenuFilter(category.id)}
                        className={clsx(
                          "motion-action rounded-full border px-3 py-1 text-xs",
                          menuFilter === category.id
                            ? "border-giotto-navy bg-giotto-cream text-giotto-navy-deep"
                            : "border-giotto-line text-giotto-muted",
                        )}
                      >
                        {category.icon ? `${category.icon} ` : ""}
                        {category.labelRu}
                      </button>
                    ))}
                  </div>
                </section>

                {dishEditorOpen ? (
                  <section className="px-4 py-4 sm:px-6">
                    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                      <div>
                        <img
                          src={dishEditor.image || PLACEHOLDER_IMAGE}
                          alt="Превью блюда"
                          className="h-40 w-full rounded-giotto-xl border border-giotto-line object-cover"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field
                          label="Название (RU)"
                          value={dishEditor.nameRu}
                          onChange={(value) =>
                            setDishEditor((current) => ({ ...current, nameRu: value }))
                          }
                        />
                        <Field
                          label="Название (IT)"
                          value={dishEditor.nameIt}
                          onChange={(value) =>
                            setDishEditor((current) => ({ ...current, nameIt: value }))
                          }
                        />
                        <Field
                          label="Цена (UZS)"
                          value={dishEditor.price}
                          onChange={(value) =>
                            setDishEditor((current) => ({ ...current, price: value }))
                          }
                        />
                        <Field
                          label="Порция"
                          value={dishEditor.portion}
                          onChange={(value) =>
                            setDishEditor((current) => ({ ...current, portion: value }))
                          }
                        />
                        <Field
                          label="Ккал"
                          value={dishEditor.energyKcal}
                          onChange={(value) =>
                            setDishEditor((current) => ({ ...current, energyKcal: value }))
                          }
                        />
                        <div className="grid gap-1">
                          <label className="text-xs text-giotto-muted">Категория</label>
                          <select
                            value={dishEditor.category}
                            onChange={(event) =>
                              setDishEditor((current) => ({ ...current, category: event.target.value }))
                            }
                            className="motion-action h-10 rounded-md border border-giotto-line px-2 text-sm outline-none focus:border-giotto-navy"
                          >
                            {restaurantData.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.labelRu}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <Field
                            label="Описание"
                            value={dishEditor.description}
                            onChange={(value) =>
                              setDishEditor((current) => ({ ...current, description: value }))
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Field
                            label="Ссылка на фото"
                            value={dishEditor.image}
                            onChange={(value) =>
                              setDishEditor((current) => ({ ...current, image: value }))
                            }
                          />
                        </div>
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 rounded-md border border-giotto-line px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={dishEditor.available}
                              onChange={(event) =>
                                setDishEditor((current) => ({
                                  ...current,
                                  available: event.target.checked,
                                }))
                              }
                            />
                            Активно
                          </label>
                          <button
                            type="button"
                            onClick={saveDishEditor}
                            className="motion-action inline-flex items-center gap-1 rounded-md bg-giotto-navy px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {dishEditorMode === "create" ? "Добавить" : "Сохранить"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDishEditorOpen(false)}
                            className="motion-action rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="px-4 py-2 sm:px-6">
                  <div className="divide-y divide-giotto-line">
                    {filteredMenu.map((dish) => {
                      const category = restaurantData.categories.find((item) => item.id === dish.category);
                      return (
                        <div
                          key={dish.id}
                          className="grid gap-2 py-3 sm:grid-cols-[72px_1.2fr_1fr_auto_auto_auto] sm:items-center"
                        >
                          <img
                            src={dish.image || PLACEHOLDER_IMAGE}
                            alt={dish.nameRu}
                            className="h-14 w-14 rounded-lg border border-giotto-line object-cover"
                          />
                          <div>
                            <p className="text-sm font-medium text-giotto-navy-deep">{dish.nameRu}</p>
                            <p className="text-xs text-giotto-muted">{dish.nameIt}</p>
                          </div>
                          <div className="text-xs text-giotto-muted">
                            <p>
                              {category?.icon ? `${category.icon} ` : ""}
                              {category?.labelRu ?? dish.category}
                            </p>
                            <p>{dish.portion}</p>
                          </div>
                          <p className="text-sm font-semibold text-giotto-ink">{formatUzs(dish.price)}</p>
                          <button
                            type="button"
                            onClick={() =>
                              updateRestaurantData((current) => ({
                                ...current,
                                dishes: current.dishes.map((candidate) =>
                                  candidate.id === dish.id
                                    ? {
                                        ...candidate,
                                        available: candidate.available === false,
                                      }
                                    : candidate,
                                ),
                              }))
                            }
                            className={clsx(
                              "motion-action rounded-md px-2 py-1 text-xs",
                              dish.available === false
                                ? "bg-[#FCEBEB] text-[#A32D2D]"
                                : "bg-[#EAF3DE] text-[#2D6A4F]",
                            )}
                          >
                            {dish.available === false ? "В стоп-листе" : "Активно"}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setDishEditorMode("edit");
                                setDishEditor(toDishEditor(dish));
                                setDishEditorOpen(true);
                              }}
                              className="motion-action rounded-md border border-giotto-line p-1.5 text-giotto-muted hover:border-giotto-navy"
                              aria-label="Редактировать"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateRestaurantData((current) => ({
                                  ...current,
                                  dishes: current.dishes.filter((candidate) => candidate.id !== dish.id),
                                }))
                              }
                              className="motion-action rounded-md border border-giotto-line p-1.5 text-[#A32D2D] hover:border-[#A32D2D]"
                              aria-label="Удалить"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredMenu.length === 0 ? (
                      <p className="py-6 text-sm text-giotto-muted">В этой категории блюд пока нет.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>

        <div className="border-t border-giotto-line bg-white px-4 py-2 sm:hidden">
          <nav className="grid grid-cols-4 gap-1" aria-label="Меню разделов">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={clsx(
                  "motion-action inline-flex flex-col items-center justify-center gap-1 rounded-md py-2 text-[10px]",
                  activeView === item.id
                    ? "bg-giotto-cream text-giotto-navy-deep"
                    : "text-giotto-muted",
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {showHistory ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-giotto-navy-deep/50 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Закрыть"
            onClick={() => setShowHistory(false)}
          />
          <div className="motion-panel-enter relative z-10 m-0 w-full max-w-[780px] rounded-t-giotto-xl border border-giotto-line bg-white p-4 sm:m-4 sm:rounded-giotto-lg">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-giotto-navy" />
              <h2 className="font-serif text-2xl text-giotto-navy-deep">История вызовов</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={historyWaiter}
                onChange={(event) => setHistoryWaiter(event.target.value)}
                className="motion-action h-10 rounded-md border border-giotto-line px-2 text-sm"
              >
                <option value="all">Все официанты</option>
                {hallData.waiters.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>
                    {waiter.name}
                  </option>
                ))}
              </select>

              <select
                value={historyTable}
                onChange={(event) => setHistoryTable(event.target.value)}
                className="motion-action h-10 rounded-md border border-giotto-line px-2 text-sm"
              >
                <option value="all">Все столы</option>
                {tables.map((table) => (
                  <option key={table.tableId} value={String(table.tableId)}>
                    Стол {table.tableId}
                  </option>
                ))}
              </select>

              <select
                value={historyType}
                onChange={(event) =>
                  setHistoryType(
                    event.target.value === "bill" ? "bill" : event.target.value === "waiter" ? "waiter" : "all",
                  )
                }
                className="motion-action h-10 rounded-md border border-giotto-line px-2 text-sm"
              >
                <option value="all">Все типы</option>
                <option value="waiter">Вызов официанта</option>
                <option value="bill">Просит счёт</option>
              </select>
            </div>

            <div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
              {filteredHistory.map((request) => {
                const waiter = request.acknowledgedBy
                  ? hallData.waiters.find((item) => item.id === request.acknowledgedBy)
                  : undefined;
                const reaction = request.acknowledgedAt
                  ? `${Math.max(1, Math.round((request.acknowledgedAt - request.createdAt) / 60000))} мин`
                  : "—";

                return (
                  <div key={request.id} className="rounded-md border border-giotto-line px-3 py-2 text-sm">
                    <p className="font-medium text-giotto-navy-deep">
                      {new Date(request.createdAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {"  "}
                      Стол {request.tableId} · {REQUEST_META[request.type].title}
                    </p>
                    <p className="text-xs text-giotto-muted">
                      Причина: {request.reason} · Реакция: {reaction}
                      {waiter ? ` · ${waiter.name}` : ""}
                    </p>
                  </div>
                );
              })}

              {filteredHistory.length === 0 ? (
                <p className="rounded-md border border-giotto-line px-3 py-3 text-sm text-giotto-muted">
                  По выбранному фильтру данных нет.
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="motion-action rounded-md border border-giotto-line px-3 py-1.5 text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {unresolvedRequests.length > 0 ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40 hidden rounded-lg border border-[#E8D6B5] bg-[#FFF8EC] px-3 py-2 text-xs text-[#8A6A33] shadow-[0_8px_20px_rgba(13,43,107,0.15)] sm:block">
          <p className="inline-flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            {unresolvedRequests.length} активных вызовов
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={resetHallData}
          className="motion-action inline-flex items-center gap-1 rounded-md border border-giotto-line px-3 py-1.5 text-xs text-giotto-muted"
        >
          <Save className="h-3.5 w-3.5" />
          Сбросить демо-данные зала
        </button>
      </div>
    </main>
  );
}

function Kpi({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="motion-surface rounded-giotto-xl bg-giotto-cream/45 px-3 py-3">
      <p className="text-xs text-giotto-muted">{title}</p>
      <p className="mt-1 text-lg font-semibold text-giotto-navy-deep">{value}</p>
      <p className="text-[11px] text-giotto-muted">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-giotto-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="motion-action h-10 rounded-md border border-giotto-line px-2 text-sm outline-none focus:border-giotto-navy"
      />
    </label>
  );
}
