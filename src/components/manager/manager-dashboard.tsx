"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  BellRing,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PencilLine,
  PlusCircle,
  Save,
  Store,
  TableProperties,
  Trash2,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { useRestaurantData } from "@/lib/restaurant-store";
import type { Dish, MenuCategoryId, RestaurantProfile } from "@/lib/types";

type ViewId = "overview" | "tables" | "requests" | "menu" | "restaurant";
type TableStatus = "free" | "occupied" | "waiter" | "bill" | "complaint";
type RequestType = "waiter" | "bill" | "complaint";

type ServiceRequest = {
  id: string;
  table: number;
  type: RequestType;
  guestMessage: string;
  minutesAgo: number;
  resolved: boolean;
};

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
  badgeLabel: string;
};

const TABLE_STATUSES: TableStatus[] = Array.from({ length: 35 }, (_, i) => {
  const table = i + 1;
  if (table === 3 || table === 8) return "waiter";
  if (table === 15) return "bill";
  if (table === 22) return "complaint";
  if (table % 2 === 0 || table % 5 === 0) return "occupied";
  return "free";
});

const INITIAL_REQUESTS: ServiceRequest[] = [
  {
    id: "r1",
    table: 3,
    type: "waiter",
    guestMessage: "Нужна помощь с выбором блюда",
    minutesAgo: 2,
    resolved: false,
  },
  {
    id: "r2",
    table: 8,
    type: "waiter",
    guestMessage: "Позовите официанта",
    minutesAgo: 4,
    resolved: false,
  },
  {
    id: "r3",
    table: 15,
    type: "bill",
    guestMessage: "Готовы оплатить",
    minutesAgo: 1,
    resolved: false,
  },
  {
    id: "r4",
    table: 22,
    type: "complaint",
    guestMessage: "Блюдо принесли холодным",
    minutesAgo: 5,
    resolved: false,
  },
];

const STATUS_META: Record<TableStatus, { label: string; className: string }> = {
  free: { label: "Свободен", className: "bg-[#EAF3DE] text-[#3B6D11]" },
  occupied: { label: "Занят", className: "bg-[#E6F1FB] text-[#185FA5]" },
  waiter: { label: "Вызов", className: "bg-[#FAEEDA] text-[#854F0B]" },
  bill: { label: "Счёт", className: "bg-[#EEEDFE] text-[#3C3489]" },
  complaint: { label: "Жалоба", className: "bg-[#FCEBEB] text-[#A32D2D]" },
};

const REQUEST_META: Record<RequestType, { label: string; className: string }> = {
  waiter: { label: "Вызов официанта", className: "bg-[#FAEEDA] text-[#854F0B]" },
  bill: { label: "Запрос счёта", className: "bg-[#EEEDFE] text-[#3C3489]" },
  complaint: { label: "Жалоба", className: "bg-[#FCEBEB] text-[#A32D2D]" },
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=85";

function formatUzs(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " UZS";
}

function makeCategoryId(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length > 0) return normalized;
  return `category-${Date.now()}`;
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
    badgeLabel: "",
  };
}

function toEditorState(dish: Dish): DishEditorState {
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
    badgeLabel: dish.badgeLabel ?? "",
  };
}

async function toDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function ManagerDashboard() {
  const { data, updateData, resetData } = useRestaurantData();
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>(TABLE_STATUSES);
  const [requests, setRequests] = useState<ServiceRequest[]>(INITIAL_REQUESTS);
  const [now, setNow] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState<"all" | MenuCategoryId>("all");
  const [profileDraft, setProfileDraft] = useState<RestaurantProfile>(data.profile);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("🍽️");
  const [categoryError, setCategoryError] = useState("");
  const [dishEditor, setDishEditor] = useState<DishEditorState>(() =>
    emptyDish(data.categories[0]?.id ?? "antipasti"),
  );

  const categoryIconPresets = ["🍽️", "🥗", "🍲", "🍝", "🍕", "🍔", "🍣", "🍰", "🍹", "☕"];

  useEffect(() => {
    setProfileDraft(data.profile);
  }, [data.profile]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unresolvedRequests = useMemo(
    () => requests.filter((request) => !request.resolved),
    [requests],
  );

  const occupiedCount = useMemo(
    () => tableStatuses.filter((status) => status !== "free").length,
    [tableStatuses],
  );

  const revenueToday = useMemo(() => data.dishes.reduce((sum, dish) => sum + dish.price, 0) * 2, [
    data.dishes,
  ]);

  const averageCheck = useMemo(() => Math.round(revenueToday / Math.max(occupiedCount, 1)), [
    occupiedCount,
    revenueToday,
  ]);

  const filteredDishes = useMemo(() => {
    if (categoryFilter === "all") return data.dishes;
    return data.dishes.filter((dish) => dish.category === categoryFilter);
  }, [categoryFilter, data.dishes]);

  const navItems: Array<{
    id: ViewId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: "overview", label: "Обзор", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "tables", label: "Столы", icon: <TableProperties className="h-4 w-4" /> },
    {
      id: "requests",
      label: "Запросы",
      icon: <BellRing className="h-4 w-4" />,
      badge: unresolvedRequests.length,
    },
    { id: "menu", label: "Меню", icon: <UtensilsCrossed className="h-4 w-4" /> },
    { id: "restaurant", label: "Ресторан", icon: <Store className="h-4 w-4" /> },
  ];

  function cycleStatus(index: number) {
    setTableStatuses((current) =>
      current.map((status, i) => {
        if (i !== index) return status;
        if (status === "free") return "occupied";
        if (status === "occupied") return "waiter";
        if (status === "waiter") return "bill";
        if (status === "bill") return "complaint";
        return "free";
      }),
    );
  }

  function resolveRequest(id: string) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, resolved: true } : request,
      ),
    );
  }

  function startCreateDish() {
    setEditorMode("create");
    setDishEditor(emptyDish(data.categories[0]?.id ?? "antipasti"));
    setEditorOpen(true);
  }

  function startEditDish(dish: Dish) {
    setEditorMode("edit");
    setDishEditor(toEditorState(dish));
    setEditorOpen(true);
  }

  async function onDishImageFileChange(file: File | null) {
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    setDishEditor((current) => ({ ...current, image: dataUrl }));
  }

  async function onProfileImageFileChange(field: "logo" | "banner", file: File | null) {
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    setProfileDraft((current) => ({ ...current, [field]: dataUrl }));
  }

  function saveDish() {
    if (!dishEditor.nameRu.trim() || !dishEditor.category.trim()) return;
    const nextDish: Dish = {
      id:
        dishEditor.id ??
        `${dishEditor.nameRu.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-")}-${Date.now()}`,
      category: dishEditor.category,
      nameRu: dishEditor.nameRu.trim(),
      nameIt: dishEditor.nameIt.trim() || dishEditor.nameRu.trim(),
      description: dishEditor.description.trim() || "Описание добавит менеджер позже.",
      price: Math.max(Number(dishEditor.price) || 0, 0),
      image: dishEditor.image || PLACEHOLDER_IMAGE,
      portion: dishEditor.portion.trim() || "250 г",
      energyKcal: Math.max(Number(dishEditor.energyKcal) || 0, 0),
      badgeLabel: dishEditor.badgeLabel.trim() || undefined,
      badgeTone: "gold",
      highlight: false,
      available: dishEditor.available,
    };

    updateData((current) => {
      if (editorMode === "edit" && dishEditor.id) {
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
    setEditorOpen(false);
  }

  function deleteDish(id: string) {
    updateData((current) => ({
      ...current,
      dishes: current.dishes.filter((dish) => dish.id !== id),
    }));
  }

  function saveProfile() {
    updateData((current) => ({
      ...current,
      profile: profileDraft,
    }));
  }

  function toggleDishAvailability(id: string) {
    updateData((current) => ({
      ...current,
      dishes: current.dishes.map((dish) =>
        dish.id === id ? { ...dish, available: dish.available === false } : dish,
      ),
    }));
  }

  function createCategory() {
    const label = newCategoryName.trim();
    const icon = newCategoryIcon.trim() || "🍽️";
    if (!label) {
      setCategoryError("Введите название категории.");
      return;
    }

    const id = makeCategoryId(label);
    const exists = data.categories.some(
      (category) =>
        category.id.toLowerCase() === id.toLowerCase() ||
        category.labelRu.toLowerCase() === label.toLowerCase(),
    );

    if (exists) {
      setCategoryError("Такая категория уже существует.");
      return;
    }

    updateData((current) => ({
      ...current,
      categories: [...current.categories, { id, labelRu: label, icon }],
    }));

    setCategoryFilter(id);
    setDishEditor((current) => ({ ...current, category: id }));
    setNewCategoryName("");
    setCategoryError("");
  }

  return (
    <main className="motion-page mx-auto w-full max-w-[1380px] px-4 py-4 sm:px-6">
      <div className="motion-surface overflow-hidden rounded-[28px] border border-giotto-line bg-white/95 shadow-[0_18px_48px_rgba(8,29,54,0.08)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-giotto-line px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={data.profile.logo}
              alt={data.profile.name}
              className="h-11 w-11 rounded-full border border-giotto-line object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-giotto-navy-deep">
                {data.profile.name}
              </p>
              <p className="truncate text-xs text-giotto-muted">{data.profile.subtitle}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-full border border-giotto-line bg-giotto-cream px-3 py-1 text-xs text-giotto-muted">
              {now.toLocaleTimeString("ru-RU")}
            </div>
            <Link
              href="/manager/logout"
              className="motion-action inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1 text-xs font-medium text-giotto-ink transition hover:border-giotto-navy hover:text-giotto-navy"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </Link>
          </div>
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
                    "motion-action flex items-center gap-2 rounded-giotto px-3 py-2 text-left text-sm transition",
                    activeView === item.id
                      ? "bg-white text-giotto-navy-deep shadow-[0_3px_12px_rgba(8,29,54,0.08)]"
                      : "text-giotto-muted hover:bg-white/70",
                  )}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-[#E24B4A] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            {activeView === "overview" ? (
              <div className="divide-y divide-giotto-line">
                <section className="px-4 py-4 sm:px-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Kpi title="Занято столов" value={`${occupiedCount}/35`} subtitle="Текущая загрузка" />
                    <Kpi
                      title="Активные запросы"
                      value={String(unresolvedRequests.length)}
                      subtitle="Реальное время"
                    />
                    <Kpi title="Выручка сегодня" value={formatUzs(revenueToday)} subtitle="Черновой расчёт" />
                    <Kpi title="Средний чек" value={formatUzs(averageCheck)} subtitle="По активным столам" />
                  </div>
                </section>
                <section className="px-4 py-4 sm:px-6">
                  <p className="text-sm font-semibold text-giotto-navy-deep">Последние запросы</p>
                  <div className="mt-3 space-y-2">
                    {unresolvedRequests.map((request) => (
                      <div key={request.id} className="flex flex-wrap items-center gap-2 rounded-giotto bg-giotto-cream/55 px-3 py-2">
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-giotto-navy">
                          Стол {request.table}
                        </span>
                        <span className={clsx("rounded-md px-2 py-1 text-xs", REQUEST_META[request.type].className)}>
                          {REQUEST_META[request.type].label}
                        </span>
                        <span className="text-xs text-giotto-muted">{request.guestMessage}</span>
                        <button
                          type="button"
                          onClick={() => resolveRequest(request.id)}
                          className="motion-action ml-auto rounded-md border border-giotto-line px-2 py-1 text-xs hover:border-giotto-navy"
                        >
                          Принять
                        </button>
                      </div>
                    ))}
                    {unresolvedRequests.length === 0 ? (
                      <p className="text-sm text-giotto-muted">Новых запросов нет.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}

            {activeView === "tables" ? (
              <div className="px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-giotto-navy-deep">Карта столов</p>
                <p className="mt-1 text-xs text-giotto-muted">
                  Нажми на стол, чтобы сменить статус вручную.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                  {tableStatuses.map((status, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => cycleStatus(index)}
                      className={clsx(
                        "motion-action rounded-giotto px-2 py-2 text-center",
                        STATUS_META[status].className,
                      )}
                    >
                      <p className="text-xs font-semibold">#{index + 1}</p>
                      <p className="text-[10px]">{STATUS_META[status].label}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeView === "requests" ? (
              <div className="px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-giotto-navy-deep">Запросы гостей</p>
                <div className="mt-3 space-y-2">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className={clsx(
                        "flex flex-wrap items-center gap-2 rounded-giotto px-3 py-2",
                        request.resolved ? "bg-white text-giotto-muted" : "bg-giotto-cream/55",
                      )}
                    >
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-giotto-navy">
                        Стол {request.table}
                      </span>
                      <span className={clsx("rounded-md px-2 py-1 text-xs", REQUEST_META[request.type].className)}>
                        {REQUEST_META[request.type].label}
                      </span>
                      <span className="text-xs">{request.guestMessage}</span>
                      <span className="text-xs text-giotto-muted">{request.minutesAgo} мин</span>
                      {!request.resolved ? (
                        <button
                          type="button"
                          onClick={() => resolveRequest(request.id)}
                          className="motion-action ml-auto rounded-md border border-giotto-line px-2 py-1 text-xs hover:border-giotto-navy"
                        >
                          Закрыть
                        </button>
                      ) : (
                        <span className="ml-auto text-xs font-medium text-[#3B6D11]">Решено</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeView === "menu" ? (
              <div className="divide-y divide-giotto-line">
                <section className="px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-giotto-navy-deep">Меню ресторана</p>
                    <button
                      type="button"
                      onClick={startCreateDish}
                      className="motion-action ml-auto inline-flex items-center gap-1 rounded-full border border-giotto-line px-3 py-1 text-xs font-medium text-giotto-ink transition hover:border-giotto-navy"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Добавить блюдо
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("all")}
                      className={clsx(
                        "motion-action rounded-full border px-3 py-1 text-xs",
                        categoryFilter === "all"
                          ? "border-giotto-navy bg-giotto-cream text-giotto-navy-deep"
                          : "border-giotto-line text-giotto-muted",
                      )}
                    >
                      Все
                    </button>
                    {data.categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryFilter(category.id)}
                        className={clsx(
                          "motion-action rounded-full border px-3 py-1 text-xs",
                          categoryFilter === category.id
                            ? "border-giotto-navy bg-giotto-cream text-giotto-navy-deep"
                            : "border-giotto-line text-giotto-muted",
                        )}
                      >
                        {category.icon ? `${category.icon} ` : ""}
                        {category.labelRu}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 rounded-giotto-xl border border-giotto-line bg-giotto-cream/35 p-3">
                    <p className="text-xs font-medium text-giotto-muted">Создать категорию</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_90px_auto]">
                      <input
                        value={newCategoryName}
                        onChange={(event) => {
                          setNewCategoryName(event.target.value);
                          if (categoryError) setCategoryError("");
                        }}
                        placeholder="Например: Гриль"
                        className="h-10 rounded-md border border-giotto-line bg-white px-3 text-sm outline-none focus:border-giotto-navy"
                      />
                      <input
                        value={newCategoryIcon}
                        onChange={(event) => setNewCategoryIcon(event.target.value)}
                        placeholder="🍽️"
                        className="h-10 rounded-md border border-giotto-line bg-white px-3 text-sm outline-none focus:border-giotto-navy"
                      />
                      <button
                        type="button"
                        onClick={createCategory}
                        className="motion-action inline-flex h-10 items-center justify-center gap-1 rounded-md bg-giotto-navy px-3 text-xs font-medium text-white"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Добавить категорию
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {categoryIconPresets.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setNewCategoryIcon(icon)}
                          className={clsx(
                            "motion-action rounded-md border px-2 py-1 text-sm",
                            newCategoryIcon === icon
                              ? "border-giotto-navy bg-white"
                              : "border-giotto-line bg-white/70",
                          )}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    {categoryError ? (
                      <p className="mt-2 text-xs text-[#A32D2D]">{categoryError}</p>
                    ) : null}
                  </div>
                </section>

                {editorOpen ? (
                  <section className="px-4 py-4 sm:px-6">
                    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                      <div>
                        <img
                          src={dishEditor.image || PLACEHOLDER_IMAGE}
                          alt="Превью блюда"
                          className="h-40 w-full rounded-giotto-xl border border-giotto-line object-cover"
                        />
                        <label className="motion-action mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md border border-giotto-line px-2 py-1 text-xs hover:border-giotto-navy">
                          <ImagePlus className="h-3.5 w-3.5" />
                          Загрузить фото
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) =>
                              onDishImageFileChange(event.target.files?.[0] ?? null)
                            }
                          />
                        </label>
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
                        <div className="space-y-1">
                          <label className="text-xs text-giotto-muted">Категория</label>
                          <select
                            value={dishEditor.category}
                            onChange={(event) =>
                              setDishEditor((current) => ({ ...current, category: event.target.value }))
                            }
                            className="h-10 w-full rounded-md border border-giotto-line px-2 text-sm outline-none focus:border-giotto-navy"
                          >
                            {data.categories.map((category) => (
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
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 rounded-md border border-giotto-line px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={dishEditor.available}
                              onChange={(event) =>
                                setDishEditor((current) => ({ ...current, available: event.target.checked }))
                              }
                            />
                            В наличии
                          </label>
                          <button
                            type="button"
                            onClick={saveDish}
                            className="motion-action inline-flex items-center gap-1 rounded-md bg-giotto-navy px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {editorMode === "create" ? "Добавить блюдо" : "Сохранить изменения"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorOpen(false)}
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
                    {filteredDishes.map((dish) => {
                      const category = data.categories.find((item) => item.id === dish.category);
                      return (
                        <div key={dish.id} className="grid gap-2 py-3 sm:grid-cols-[72px_1.2fr_1fr_auto_auto_auto] sm:items-center">
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
                            <p>{category?.icon ? `${category.icon} ` : ""}{category?.labelRu ?? dish.category}</p>
                            <p>{dish.portion}</p>
                          </div>
                          <p className="text-sm font-semibold text-giotto-ink">{formatUzs(dish.price)}</p>
                          <button
                            type="button"
                            onClick={() => toggleDishAvailability(dish.id)}
                            className={clsx(
                              "motion-action rounded-md px-2 py-1 text-xs",
                              dish.available === false
                                ? "bg-[#FCEBEB] text-[#A32D2D]"
                                : "bg-[#EAF3DE] text-[#3B6D11]",
                            )}
                          >
                            {dish.available === false ? "Скрыто" : "В наличии"}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditDish(dish)}
                              className="motion-action rounded-md border border-giotto-line p-1.5 text-giotto-muted hover:border-giotto-navy hover:text-giotto-navy"
                              aria-label="Редактировать блюдо"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDish(dish.id)}
                              className="motion-action rounded-md border border-giotto-line p-1.5 text-[#A32D2D] hover:border-[#A32D2D]"
                              aria-label="Удалить блюдо"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredDishes.length === 0 ? (
                      <p className="py-6 text-sm text-giotto-muted">В этой категории блюд пока нет.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}

            {activeView === "restaurant" ? (
              <div className="divide-y divide-giotto-line">
                <section className="px-4 py-4 sm:px-6">
                  <p className="text-sm font-semibold text-giotto-navy-deep">
                    Настройки ресторана (синхронизируются с гостевой страницей)
                  </p>
                  <p className="mt-1 text-xs text-giotto-muted">
                    После сохранения изменения сразу видны в `/table/*` и `/table/*/menu`.
                  </p>
                </section>

                <section className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[220px_1fr]">
                  <div>
                    <img
                      src={profileDraft.logo}
                      alt="Логотип"
                      className="h-28 w-28 rounded-full border border-giotto-line object-cover"
                    />
                    <label className="motion-action mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md border border-giotto-line px-2 py-1 text-xs hover:border-giotto-navy">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Логотип (файл)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          onProfileImageFileChange("logo", event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field
                      label="Название"
                      value={profileDraft.name}
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, name: value }))
                      }
                    />
                    <Field
                      label="Подзаголовок"
                      value={profileDraft.subtitle}
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, subtitle: value }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="Описание"
                        value={profileDraft.description}
                        onChange={(value) =>
                          setProfileDraft((current) => ({ ...current, description: value }))
                        }
                      />
                    </div>
                    <Field
                      label="Wi‑Fi SSID"
                      value={profileDraft.wifiName}
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, wifiName: value }))
                      }
                    />
                    <Field
                      label="Wi‑Fi пароль"
                      value={profileDraft.wifiPassword}
                      onChange={(value) =>
                        setProfileDraft((current) => ({ ...current, wifiPassword: value }))
                      }
                    />
                  </div>
                </section>

                <section className="grid gap-3 px-4 py-4 sm:px-6">
                  <p className="text-xs text-giotto-muted">Баннер ресторана</p>
                  <img
                    src={profileDraft.banner}
                    alt="Баннер"
                    className="h-40 w-full rounded-giotto-xl border border-giotto-line object-cover"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="motion-action inline-flex cursor-pointer items-center gap-1 rounded-md border border-giotto-line px-2 py-1 text-xs hover:border-giotto-navy">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Баннер (файл)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          onProfileImageFileChange("banner", event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={saveProfile}
                      className="motion-action inline-flex items-center gap-1 rounded-md bg-giotto-navy px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Сохранить профиль
                    </button>
                    <button
                      type="button"
                      onClick={resetData}
                      className="motion-action inline-flex items-center gap-1 rounded-md border border-giotto-line px-3 py-1.5 text-xs"
                    >
                      <Wifi className="h-3.5 w-3.5" />
                      Сбросить демо-данные
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
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
