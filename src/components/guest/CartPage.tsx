"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatPriceUZS } from "@/lib/format";
import { getDishByIdFromData, useRestaurantData } from "@/lib/restaurant-store";

type Props = { tableId: string };

export function CartPage({ tableId }: Props) {
  const base = `/table/${tableId}`;
  const menu = `${base}/menu`;
  const router = useRouter();
  const { lines, setQty, totalSum, clear } = useCart();
  const { data } = useRestaurantData();
  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);

  const checkout = () => {
    if (lines.length === 0) return;
    clear();
    router.push(menu);
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-guest flex-col overflow-hidden bg-[#f6f1e8]">
      <header
        className="relative z-20 border-b border-white/70 bg-white/70 backdrop-blur-xl"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center gap-2">
            <Link
              href={menu}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d9cfbd] bg-white text-giotto-navy transition hover:bg-[#f8f3ea]"
              aria-label="К меню"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={1.9} />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate font-serif text-[1.85rem] font-semibold leading-none text-giotto-navy-deep">
                Корзина
              </h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-giotto-muted">
                заказ по столу
              </p>
            </div>
            <div className="h-11 w-11" aria-hidden />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-3 pb-32 pt-3">
        {lines.length === 0 ? (
          <div className="px-2 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2fb] text-giotto-navy">
              <ShoppingBag className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <p className="mt-4 font-serif text-2xl font-semibold text-giotto-navy-deep">
              Пусто
            </p>
            <p className="mt-2 text-sm leading-relaxed text-giotto-muted">
              Добавьте блюда из меню, и корзина соберется автоматически.
            </p>
            <Link
              href={menu}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-[0.85rem] border border-[#d6ccba] bg-[#f7f2e8] px-6 text-sm font-semibold text-giotto-navy transition hover:bg-white"
            >
              Перейти в меню
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#e5dccb] border-y border-[#e5dccb] bg-transparent">
            {lines.map((line) => {
              const d = getDishByIdFromData(data.dishes, line.dishId);
              if (!d) return null;
              return (
                <li key={line.lineId} className="bg-transparent">
                  <div className="flex items-center gap-3 px-1 py-3">
                    <div className="relative h-[4.35rem] w-[5.4rem] shrink-0 overflow-hidden rounded-[0.8rem] bg-giotto-line">
                      <Image
                        src={d.image}
                        alt={d.nameRu}
                        fill
                        className="object-cover"
                        sizes="86px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-sans text-[1rem] font-semibold leading-[1.2] text-giotto-ink">
                        {d.nameRu}
                      </p>
                      <p className="mt-1 text-xs text-giotto-muted">
                        {formatPriceUZS(d.price)} за порцию
                      </p>
                      <p className="mt-1.5 font-sans text-[0.98rem] font-semibold text-giotto-navy-deep">
                        {formatPriceUZS(d.price * line.qty)}
                      </p>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-[#d8cebc] bg-white/90 p-0.5">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-giotto-navy transition hover:bg-[#f3eee4]"
                        onClick={() => setQty(line.lineId, line.qty - 1)}
                        aria-label="Меньше"
                      >
                        <Minus className="h-4 w-4" strokeWidth={2.6} />
                      </button>
                      <span className="min-w-[1.4rem] text-center text-[0.93rem] font-semibold text-giotto-navy-deep">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-giotto-navy transition hover:bg-[#f3eee4]"
                        onClick={() => setQty(line.lineId, line.qty + 1)}
                        aria-label="Больше"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2d8c7] bg-[#f8f3ea]/95 px-3 pb-[max(0.65rem,var(--safe-bottom))] pt-2 backdrop-blur-sm">
          <div className="mx-auto max-w-guest">
            <div className="mb-2 flex items-end justify-between px-0.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-giotto-muted">
                К оплате
              </p>
              <p className="text-xs text-giotto-muted">{totalQty} шт.</p>
            </div>
            <div className="mb-2 px-0.5 font-serif text-[1.3rem] font-semibold leading-none text-giotto-navy-deep">
              {formatPriceUZS(totalSum)}
            </div>
            <button
              type="button"
              onClick={checkout}
              className="flex h-[50px] w-full items-center justify-center rounded-[0.85rem] bg-gradient-to-r from-[#0d2a64] to-[#091c46] text-sm font-semibold text-white transition hover:brightness-105"
            >
              Оформить заказ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
