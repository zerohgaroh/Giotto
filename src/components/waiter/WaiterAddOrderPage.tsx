"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";
import { formatPriceUZS } from "@/lib/format";
import { useRestaurantData } from "@/lib/restaurant-store";

type Props = {
  tableId: number;
};

export function WaiterAddOrderPage({ tableId }: Props) {
  const router = useRouter();
  const { data: restaurant } = useRestaurantData();

  const [category, setCategory] = useState<string>("all");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const response = await fetch(`/api/waiter/tables/${tableId}`, { cache: "no-store" });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (response.status === 403 || response.status === 404) {
          setAccessDenied(true);
          return;
        }
        setAccessDenied(false);
      } catch {
        // keep optimistic mode on network glitches
      }
    };
    void verifyAccess();
  }, [tableId]);

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

  if (accessDenied) {
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

  const submitOrder = async () => {
    if (selected.length === 0 || saving) return;

    setSaving(true);
    setErrorText("");

    try {
      const response = await fetch(`/api/waiter/tables/${tableId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((entry) => ({
            dishId: entry.dish.id,
            title: entry.dish.nameIt,
            qty: entry.qty,
            price: entry.dish.price,
          })),
        }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Не удалось добавить позиции");
      }

      router.push(`/waiter/tables/${tableId}`);
    } catch {
      setErrorText("Не удалось добавить позиции в счет.");
    } finally {
      setSaving(false);
    }
  };

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

      {errorText ? (
        <div className="mx-3 mt-3 rounded-lg border border-[#f2d7bf] bg-[#fff5ea] px-3 py-2 text-xs text-[#9a4f1e]">
          {errorText}
        </div>
      ) : null}

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
            disabled={selected.length === 0 || saving}
            onClick={() => {
              void submitOrder();
            }}
            className="motion-action flex h-[3rem] w-full items-center justify-center rounded-[0.9rem] bg-giotto-navy text-[13px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:bg-[#A7B2C8]"
          >
            {saving ? "Сохраняем..." : "Добавить в счёт"}
          </button>
        </div>
      </div>
    </main>
  );
}
