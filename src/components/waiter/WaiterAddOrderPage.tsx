"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";
import { formatPriceUZS } from "@/lib/format";
import { useRestaurantData } from "@/lib/restaurant-store";
import { useHallData } from "@/lib/service-store";

type Props = {
  waiterId: string;
  tableId: number;
};

export function WaiterAddOrderPage({ waiterId, tableId }: Props) {
  const router = useRouter();
  const { data: restaurant } = useRestaurantData();
  const { data: hall, updateData } = useHallData();

  const [category, setCategory] = useState<string>("all");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const table = hall.tables.find((candidate) => candidate.tableId === tableId);

  const visibleDishes = useMemo(
    () =>
      restaurant.dishes.filter(
        (dish) => dish.available !== false && (category === "all" || dish.category === category),
      ),
    [category, restaurant.dishes],
  );

  const selected = useMemo(() => {
    return restaurant.dishes
      .map((dish) => ({ dish, qty: qtyMap[dish.id] ?? 0 }))
      .filter((entry) => entry.qty > 0);
  }, [qtyMap, restaurant.dishes]);

  const totalQty = selected.reduce((sum, entry) => sum + entry.qty, 0);
  const totalSum = selected.reduce((sum, entry) => sum + entry.qty * entry.dish.price, 0);

  if (!table || table.assignedWaiterId !== waiterId) {
    return (
      <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col items-center justify-center px-5 text-center">
        <h1 className="font-serif text-3xl font-semibold text-giotto-navy-deep">Нет доступа</h1>
        <p className="mt-2 text-sm text-giotto-muted">Этот стол не назначен вам.</p>
        <Link
          href="/waiter"
          className="motion-action mt-5 inline-flex min-h-[2.8rem] items-center justify-center rounded-xl border border-giotto-line px-5 text-sm font-semibold text-giotto-navy"
        >
          К моим столам
        </Link>
      </main>
    );
  }

  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col pb-[calc(6.2rem+var(--safe-bottom))]">
      <header
        className="motion-surface sticky top-0 z-30 border-b border-giotto-line bg-giotto-cream/94 px-3 pb-3 pt-2 backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-giotto-muted">
              Добавить в счёт
            </p>
            <h1 className="truncate font-serif text-[1.75rem] leading-none text-giotto-navy-deep">
              Стол {tableId}
            </h1>
          </div>
          <Link
            href={`/waiter/tables/${tableId}`}
            className="motion-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-giotto-line bg-white text-giotto-navy"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" strokeWidth={1.9} />
          </Link>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ id: "all", labelRu: "Все" }, ...restaurant.categories].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={clsx(
                "motion-action shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium",
                category === item.id
                  ? "border-giotto-navy bg-giotto-navy text-white"
                  : "border-giotto-line bg-white text-giotto-muted",
              )}
            >
              {item.labelRu}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 px-3 pt-3">
        {visibleDishes.map((dish) => {
          const qty = qtyMap[dish.id] ?? 0;
          return (
            <article
              key={dish.id}
              className="motion-surface flex flex-col overflow-hidden rounded-[1rem] border border-[#E6DFD2] bg-white"
            >
              <div className="relative aspect-[1.2] w-full overflow-hidden bg-giotto-line">
                <Image
                  src={dish.image}
                  alt={dish.nameRu}
                  fill
                  className="object-cover"
                  sizes="(max-width: 480px) 50vw, 220px"
                />
              </div>
              <div className="flex flex-1 flex-col p-2.5">
                <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-giotto-ink">
                  {dish.nameRu}
                </p>
                <p className="mt-1 text-[12px] text-giotto-muted">{formatPriceUZS(dish.price)}</p>

                <div className="mt-auto pt-2">
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => setQtyMap((current) => ({ ...current, [dish.id]: 1 }))}
                      className="motion-action flex min-h-[2.3rem] w-full items-center justify-center rounded-[0.75rem] bg-giotto-navy text-[12px] font-semibold text-white"
                    >
                      <Plus className="mr-1 h-4 w-4" strokeWidth={2.1} /> Добавить
                    </button>
                  ) : (
                    <div className="flex min-h-[2.3rem] items-center justify-between rounded-[0.75rem] bg-giotto-navy px-1 text-white">
                      <button
                        type="button"
                        onClick={() =>
                          setQtyMap((current) => ({
                            ...current,
                            [dish.id]: Math.max(0, (current[dish.id] ?? 0) - 1),
                          }))
                        }
                        className="motion-action inline-flex h-8 w-8 items-center justify-center rounded-full"
                        aria-label="Уменьшить"
                      >
                        <Minus className="h-4 w-4" strokeWidth={2.3} />
                      </button>
                      <span className="min-w-[1.2rem] text-center text-[13px] font-semibold">{qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setQtyMap((current) => ({
                            ...current,
                            [dish.id]: (current[dish.id] ?? 0) + 1,
                          }))
                        }
                        className="motion-action inline-flex h-8 w-8 items-center justify-center rounded-full"
                        aria-label="Увеличить"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.3} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <div
        className="motion-surface fixed inset-x-0 bottom-0 z-40 border-t border-giotto-line bg-white/96 px-4 py-2.5 backdrop-blur-md"
        style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
      >
        <div className="mx-auto max-w-guest">
          <div className="mb-2 flex items-end justify-between px-1">
            <p className="text-[10px] uppercase tracking-[0.15em] text-giotto-muted">Корзина</p>
            <p className="text-xs text-giotto-muted">{totalQty} шт.</p>
          </div>
          <p className="mb-2 px-1 font-serif text-[1.2rem] font-semibold text-giotto-navy-deep">
            {formatPriceUZS(totalSum)}
          </p>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              const createdAt = Date.now();
              const nextLines = selected.map((entry) => ({
                id: `waiter-${entry.dish.id}-${createdAt}-${Math.random().toString(16).slice(2, 8)}`,
                tableId,
                dishId: entry.dish.id,
                title: entry.dish.nameIt,
                qty: entry.qty,
                price: entry.dish.price,
                source: "waiter" as const,
                createdAt,
              }));

              updateData((current) => ({
                ...current,
                billLines: [...current.billLines, ...nextLines],
                tables: current.tables.map((candidate) =>
                  candidate.tableId === tableId
                    ? {
                        ...candidate,
                        status: "ordered",
                      }
                    : candidate,
                ),
              }));

              router.push(`/waiter/tables/${tableId}`);
            }}
            className="motion-action flex h-[3rem] w-full items-center justify-center rounded-[0.9rem] bg-giotto-navy text-[13px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:bg-[#A7B2C8]"
          >
            Добавить в счёт
          </button>
        </div>
      </div>
    </main>
  );
}
