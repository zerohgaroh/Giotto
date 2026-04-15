"use client";

import Image from "next/image";
import { X } from "lucide-react";
import clsx from "clsx";
import type { Dish } from "@/lib/types";
import { formatPriceUZS } from "@/lib/format";

type Props = {
  dish: Dish | null;
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
};

export function DishSheet({ dish, open, onClose, onAdd }: Props) {
  if (!dish) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-end justify-center sm:items-center",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={clsx(
          "motion-overlay-enter absolute inset-0 bg-giotto-navy-deep/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className={clsx(
          "motion-panel-enter relative max-h-[90dvh] w-full max-w-guest overflow-hidden rounded-t-giotto-xl border border-giotto-line bg-white shadow-card transition duration-200 sm:rounded-giotto-lg",
          open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 sm:translate-y-4",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-title"
      >
        <div className="max-h-[90dvh] overflow-y-auto overscroll-contain">
          <div className="relative aspect-[16/10] w-full bg-giotto-line">
            <Image
              src={dish.image}
              alt={dish.nameRu}
              fill
              className="object-cover"
              sizes="100vw"
              priority={open}
            />
            <button
              type="button"
              onClick={onClose}
              className="motion-action absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/95 text-giotto-navy shadow-lift"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
            {dish.highlight ? (
              <span className="inline-block rounded-md bg-giotto-gold/25 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-giotto-navy-deep">
                Шеф рекомендует
              </span>
            ) : null}
            <h2
              id="dish-title"
              className="mt-2 font-serif text-2xl font-semibold text-giotto-navy-deep"
            >
              {dish.nameIt}
            </h2>
            <p className="mt-1 font-serif text-base italic text-giotto-navy-soft">
              {dish.nameRu}
            </p>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-giotto-muted">
              {dish.description}
            </p>
            <div className="mt-6 flex items-center justify-between gap-4 border-t border-giotto-line pt-4">
              <p className="font-serif text-xl font-semibold text-giotto-gold">
                {formatPriceUZS(dish.price)}
              </p>
              <button
                type="button"
                onClick={() => {
                  onAdd();
                  onClose();
                }}
                className="motion-action min-h-[48px] min-w-[140px] rounded-giotto-lg bg-giotto-navy px-6 font-sans text-[15px] font-medium text-white transition hover:bg-giotto-navy-deep active:scale-[0.99]"
              >
                В корзину
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
