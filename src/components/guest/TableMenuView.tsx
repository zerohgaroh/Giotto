"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronLeft,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import clsx from "clsx";
import { useCart } from "@/context/cart-context";
import { DISHES, MENU_CATEGORIES } from "@/lib/menu-data";
import { tableLabelFromId } from "@/lib/table-label";
import type { Dish, MenuCategoryId } from "@/lib/types";
import { formatPriceUZS } from "@/lib/format";
import { DishSheet } from "./DishSheet";

type Props = { tableId: string };

const CATEGORY_IDS = new Set<MenuCategoryId>(
  MENU_CATEGORIES.map((c) => c.id),
);

function categoryFromSearch(raw: string | null): MenuCategoryId | null {
  if (!raw) return null;
  const id = raw as MenuCategoryId;
  return CATEGORY_IDS.has(id) ? id : null;
}

function badgeClasses(dish: Dish) {
  switch (dish.badgeTone) {
    case "gold":
      return "bg-[#fff2d6] text-[#8a6929]";
    case "sage":
      return "bg-[#edf4ee] text-[#40624c]";
    case "blush":
      return "bg-[#f8eae4] text-[#92584b]";
    case "navy":
    default:
      return "bg-[#edf2fb] text-giotto-navy-deep";
  }
}

export function TableMenuView({ tableId }: Props) {
  const search = useSearchParams();
  const base = `/table/${tableId}`;
  const label = tableLabelFromId(tableId);
  const [cat, setCat] = useState<MenuCategoryId>("all");

  useEffect(() => {
    const next = categoryFromSearch(search.get("cat"));
    if (next) setCat(next);
  }, [search]);
  const [sheet, setSheet] = useState<Dish | null>(null);
  const { lines, addDish, setQty, totalQty } = useCart();

  const visible = useMemo(
    () => DISHES.filter((d) => cat === "all" || d.category === cat),
    [cat],
  );

  const qtyFor = (id: string) =>
    lines.filter((l) => l.dishId === id).reduce((s, l) => s + l.qty, 0);

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(5.5rem+var(--safe-bottom))]">
      <header
        className="sticky top-0 z-30 border-b border-giotto-line/90 bg-giotto-cream/90 shadow-[0_1px_0_rgba(8,29,54,0.04)] backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="mx-auto flex max-w-guest items-center gap-2 px-3 py-2">
          <Link
            href={base}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-giotto-line bg-white text-giotto-navy transition hover:bg-giotto-paper"
            aria-label="К столу"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-giotto-muted">
              Стол {label}
            </p>
            <h1 className="truncate font-serif text-lg font-semibold text-giotto-navy-deep">
              Меню
            </h1>
          </div>
          <div className="h-11 w-11 shrink-0" aria-hidden />
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MENU_CATEGORIES.map((c) => {
            const on = c.id === cat;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 font-sans text-[13px] font-medium transition active:scale-[0.98]",
                  on
                    ? "border-giotto-navy bg-giotto-navy text-white shadow-lift"
                    : "border-giotto-line bg-white/90 text-giotto-muted hover:border-giotto-navy-soft hover:text-giotto-navy",
                )}
              >
                {c.labelRu}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto w-full max-w-guest flex-1 px-3 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
          {visible.map((dish) => {
            const q = qtyFor(dish.id);
            return (
              <article
                key={dish.id}
                className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-[#ece5d8] bg-white shadow-[0_10px_28px_rgba(8,29,54,0.08)] ring-0 transition hover:-translate-y-0.5 hover:border-giotto-gold/45 hover:shadow-card"
              >
                <button
                  type="button"
                  onClick={() => setSheet(dish)}
                  className="text-left"
                >
                  <div className="relative aspect-[0.95] w-full overflow-hidden bg-giotto-line">
                    <Image
                      src={dish.image}
                      alt={dish.nameRu}
                      fill
                      className="object-cover transition duration-500 motion-reduce:transition-none group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                      sizes="(max-width: 480px) 50vw, 240px"
                    />
                    {dish.badgeLabel ? (
                      <span
                        className={clsx(
                          "absolute left-3 top-3 rounded-[0.8rem] px-3 py-1 font-sans text-[10px] font-semibold tracking-[0.02em] shadow-[0_8px_18px_rgba(8,29,54,0.08)]",
                          badgeClasses(dish),
                        )}
                      >
                        {dish.badgeLabel}
                      </span>
                    ) : null}
                    {q > 0 ? (
                      <span className="absolute bottom-3 right-3 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-giotto-navy px-2 font-sans text-xs font-bold text-white shadow-[0_8px_18px_rgba(8,29,54,0.18)]">
                        {q}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3.5 pb-3.5 pt-3">
                    <h2 className="line-clamp-2 font-sans text-[1.02rem] font-semibold leading-[1.2] text-giotto-ink">
                      {dish.nameRu}
                    </h2>
                    <p className="mt-1 line-clamp-1 font-serif text-[13px] italic text-giotto-muted">
                      {dish.nameIt}
                    </p>
                    <p className="mt-3 text-[12px] text-giotto-muted">
                      {dish.portion} · {dish.energyKcal} ккал
                    </p>
                    <p className="mt-3 font-sans text-[1.05rem] font-bold text-giotto-navy-deep">
                      {formatPriceUZS(dish.price)}
                    </p>
                  </div>
                </button>
                <div className="mt-auto px-3.5 pb-3.5">
                  {q === 0 ? (
                    <button
                      type="button"
                      onClick={() => addDish(dish.id)}
                      className="flex min-h-[3.35rem] w-full items-center justify-center gap-1.5 rounded-[1rem] bg-giotto-navy text-white shadow-[0_10px_18px_rgba(8,29,54,0.18)] transition hover:bg-giotto-navy-deep active:scale-95"
                      aria-label="Добавить"
                    >
                      <Plus className="h-4.5 w-4.5" strokeWidth={2.2} />
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">
                        Добавить
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-h-[3.35rem] w-full items-center justify-between rounded-[1rem] bg-giotto-navy px-2 py-1 text-white shadow-[0_10px_18px_rgba(8,29,54,0.18)]">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
                        onClick={() => {
                          const line = lines.find((l) => l.dishId === dish.id);
                          if (line) setQty(line.lineId, q - 1);
                        }}
                        aria-label="Меньше"
                      >
                        <Minus className="h-4.5 w-4.5" strokeWidth={2.5} />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-[0.98rem] font-semibold">
                        {q}
                      </span>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
                        onClick={() => addDish(dish.id)}
                        aria-label="Больше"
                      >
                        <Plus className="h-4.5 w-4.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <DishSheet
        dish={sheet}
        open={!!sheet}
        onClose={() => setSheet(null)}
        onAdd={() => sheet && addDish(sheet.id)}
      />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-giotto-line bg-white px-4 py-2 shadow-[0_-8px_30px_rgba(8,29,54,0.06)]"
        style={{ paddingBottom: "max(0.5rem, var(--safe-bottom))" }}
        aria-label="Быстрые действия"
      >
        <div className="mx-auto flex max-w-guest gap-3">
          <Link
            href={`${base}/cart`}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-giotto-lg border-2 border-giotto-navy bg-white py-3.5 font-sans text-[13px] font-bold uppercase tracking-wide text-giotto-navy transition hover:bg-giotto-navy hover:text-white"
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
            Корзина
            {totalQty > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-giotto-gold px-1 text-[10px] font-bold text-giotto-navy-deep">
                {totalQty > 99 ? "99+" : totalQty}
              </span>
            ) : null}
          </Link>
          <Link
            href={`${base}/waiter`}
            className="flex flex-1 items-center justify-center gap-2 rounded-giotto-lg bg-giotto-navy py-3.5 font-sans text-[13px] font-bold uppercase tracking-wide text-white shadow-lift transition hover:bg-giotto-navy-deep"
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            Вызов
          </Link>
        </div>
      </nav>
    </div>
  );
}
