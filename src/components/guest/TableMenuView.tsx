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
import { useRestaurantData } from "@/lib/restaurant-store";
import { tableLabelFromId } from "@/lib/table-label";
import type { Dish, MenuCategoryId } from "@/lib/types";
import { formatPriceUZS } from "@/lib/format";
import { DishSheet } from "./DishSheet";

type Props = { tableId: string };

export function TableMenuView({ tableId }: Props) {
  const search = useSearchParams();
  const { data } = useRestaurantData();
  const { categories, dishes, profile } = data;
  const base = `/table/${tableId}`;
  const label = tableLabelFromId(tableId);
  const [cat, setCat] = useState<MenuCategoryId>("all");

  useEffect(() => {
    const raw = search.get("cat");
    if (!raw) return;
    if (raw === "all" || categories.some((category) => category.id === raw)) {
      setCat(raw);
    }
  }, [categories, search]);
  const [sheet, setSheet] = useState<Dish | null>(null);
  const { lines, addDish, setQty, totalQty } = useCart();

  const visible = useMemo(
    () =>
      dishes.filter(
        (dish) => dish.available !== false && (cat === "all" || dish.category === cat),
      ),
    [cat, dishes],
  );

  const qtyFor = (id: string) =>
    lines.filter((l) => l.dishId === id).reduce((s, l) => s + l.qty, 0);

  return (
    <div className="motion-page flex min-h-dvh flex-col pb-[calc(5.5rem+var(--safe-bottom))]">
      <header
        className="sticky top-0 z-30 border-b border-giotto-line/90 bg-giotto-cream/90 shadow-[0_1px_0_rgba(8,29,54,0.04)] backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="mx-auto flex max-w-guest items-center gap-2 px-3 py-2">
          <Link
            href={base}
            className="motion-action flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-giotto-line bg-white text-giotto-navy transition hover:bg-giotto-paper"
            aria-label="К столу"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-giotto-muted">
              Стол {label}
            </p>
            <h1 className="truncate font-serif text-lg font-semibold text-giotto-navy-deep">
              {profile.name} · Меню
            </h1>
          </div>
          <div className="h-11 w-11 shrink-0" aria-hidden />
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ id: "all", labelRu: "Все" }, ...categories].map((c) => {
            const on = c.id === cat;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={clsx(
                  "motion-action shrink-0 rounded-full border px-4 py-2 font-sans text-[13px] font-medium transition active:scale-[0.98]",
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
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {visible.map((dish) => {
            const q = qtyFor(dish.id);
            return (
              <article
                key={dish.id}
                className="motion-surface group flex flex-col overflow-hidden rounded-[1.35rem] border border-[#ece5d8] bg-white shadow-[0_8px_22px_rgba(8,29,54,0.08)] ring-0 transition hover:-translate-y-0.5 hover:border-giotto-gold/45 hover:shadow-card"
              >
                <button
                  type="button"
                  onClick={() => setSheet(dish)}
                  className="text-left"
                >
                  <div className="relative aspect-[1.12] w-full overflow-hidden bg-giotto-line">
                    <Image
                      src={dish.image}
                      alt={dish.nameRu}
                      fill
                      className="object-cover transition duration-500 motion-reduce:transition-none group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                      sizes="(max-width: 480px) 50vw, 240px"
                    />
                  </div>
                  <div className="flex min-h-[5.7rem] flex-col px-3 pb-2.5 pt-2.5">
                    <h2 className="line-clamp-2 min-h-[2.65rem] font-sans text-[1.06rem] font-semibold leading-[1.24] tracking-[-0.01em] text-giotto-ink">
                      {dish.nameRu}
                    </h2>
                    <div className="mt-auto">
                      <p className="text-[10px] uppercase tracking-[0.11em] text-giotto-muted">
                        Цена
                      </p>
                      <p className="mt-0.5 font-sans text-[0.9rem] font-semibold text-giotto-navy">
                        {formatPriceUZS(dish.price)}
                      </p>
                    </div>
                  </div>
                </button>
                <div className="mt-auto px-3 pb-3">
                  {q === 0 ? (
                    <button
                      type="button"
                      onClick={() => addDish(dish.id)}
                      className="motion-action flex min-h-[2.8rem] w-full items-center justify-center gap-1.5 rounded-[0.9rem] bg-giotto-navy text-white shadow-[0_10px_18px_rgba(8,29,54,0.18)] transition hover:bg-giotto-navy-deep active:scale-95"
                      aria-label="Добавить"
                    >
                      <Plus className="h-4.5 w-4.5" strokeWidth={2.2} />
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">
                        Добавить
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-h-[2.8rem] w-full items-center justify-between rounded-[0.9rem] bg-giotto-navy px-1.5 py-1 text-white shadow-[0_10px_18px_rgba(8,29,54,0.18)]">
                      <button
                        type="button"
                        className="motion-action flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
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
                        className="motion-action flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
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
        {visible.length === 0 ? (
          <div className="motion-surface rounded-giotto-lg border border-giotto-line bg-white px-4 py-8 text-center text-sm text-giotto-muted">
            В этой категории пока нет доступных блюд.
          </div>
        ) : null}
      </main>

      <DishSheet
        dish={sheet}
        open={!!sheet}
        onClose={() => setSheet(null)}
        onAdd={() => sheet && addDish(sheet.id)}
      />

      <nav
        className="motion-surface fixed inset-x-0 bottom-0 z-40 border-t border-giotto-line bg-white px-4 py-2 shadow-[0_-8px_30px_rgba(8,29,54,0.06)]"
        style={{ paddingBottom: "max(0.5rem, var(--safe-bottom))" }}
        aria-label="Быстрые действия"
      >
        <div className="mx-auto flex max-w-guest gap-3">
          <Link
            href={`${base}/cart`}
            className="motion-action relative flex flex-1 items-center justify-center gap-2 rounded-giotto-lg border-2 border-giotto-navy bg-white py-3.5 font-sans text-[13px] font-bold uppercase tracking-wide text-giotto-navy transition hover:bg-giotto-navy hover:text-white"
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
            className="motion-action flex flex-1 items-center justify-center gap-2 rounded-giotto-lg bg-giotto-navy py-3.5 font-sans text-[13px] font-bold uppercase tracking-wide text-white shadow-lift transition hover:bg-giotto-navy-deep"
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            Вызов
          </Link>
        </div>
      </nav>
    </div>
  );
}
