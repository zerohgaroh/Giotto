"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { getDishById } from "@/lib/menu-data";
import { formatPriceUZS } from "@/lib/format";

type Props = { tableId: string };

export function CartPage({ tableId }: Props) {
  const base = `/table/${tableId}`;
  const menu = `${base}/menu`;
  const router = useRouter();
  const { lines, setQty, totalSum, clear } = useCart();

  const checkout = () => {
    if (lines.length === 0) return;
    clear();
    router.push(menu);
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-guest flex-col bg-giotto-paper"
      style={{ paddingBottom: "max(1.5rem, var(--safe-bottom))" }}
    >
      <header
        className="border-b border-giotto-line bg-giotto-navy text-white"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="flex items-center gap-2 px-3 py-3">
          <Link
            href={menu}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-giotto-navy-soft/40 transition hover:bg-giotto-navy-soft"
            aria-label="К меню"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          </Link>
          <div className="flex-1 text-center">
            <h1 className="font-serif text-lg font-semibold">Корзина</h1>
            <p className="text-[11px] font-medium uppercase tracking-widest text-giotto-gold-soft">
              Заказ
            </p>
          </div>
          <div className="h-11 w-11" aria-hidden />
        </div>
        <div className="flex items-center justify-between border-t border-white/15 px-4 py-3">
          <span className="text-sm text-white/85">Итого</span>
          <span className="font-serif text-lg font-semibold text-giotto-gold">
            {formatPriceUZS(totalSum)}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {lines.length === 0 ? (
          <div className="rounded-[1.75rem] border border-white/60 bg-white/75 px-5 py-16 text-center shadow-lift backdrop-blur-sm">
            <p className="font-serif text-2xl font-semibold text-giotto-navy-deep">
              Корзина пуста
            </p>
            <p className="mt-3 text-sm leading-relaxed text-giotto-muted">
              Добавьте блюда из меню, и здесь появится ваш заказ по столу.
            </p>
            <Link
              href={menu}
              className="mt-5 inline-block rounded-giotto-lg border-2 border-giotto-navy px-6 py-2.5 font-medium text-giotto-navy transition hover:bg-giotto-navy hover:text-white"
            >
              В меню
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((line) => {
              const d = getDishById(line.dishId);
              if (!d) return null;
              return (
                <li
                  key={line.lineId}
                  className="flex gap-3 rounded-[1.5rem] border border-giotto-line bg-white/95 p-3 shadow-lift"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-giotto-line">
                    <Image
                      src={d.image}
                      alt={d.nameRu}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm font-medium italic text-giotto-navy-deep">
                      {d.nameIt}
                    </p>
                    <p className="text-xs text-giotto-muted">
                      {formatPriceUZS(d.price)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-0.5 rounded-full bg-giotto-navy px-1 py-1 text-white">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/15"
                          onClick={() => setQty(line.lineId, line.qty - 1)}
                          aria-label="Меньше"
                        >
                          <Minus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <span className="min-w-[1.25rem] text-center text-sm">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/15"
                          onClick={() => setQty(line.lineId, line.qty + 1)}
                          aria-label="Больше"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                      <span className="font-serif text-sm font-semibold text-giotto-gold">
                        {formatPriceUZS(d.price * line.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-giotto-line bg-white px-4 py-3">
        <button
          type="button"
          disabled={lines.length === 0}
          onClick={checkout}
          className="flex h-[52px] w-full items-center justify-center rounded-giotto-lg bg-giotto-navy font-medium text-white transition hover:bg-giotto-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Оформить заказ
        </button>
      </div>
    </div>
  );
}
