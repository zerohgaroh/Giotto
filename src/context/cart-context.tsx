"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDishByIdFromData, useRestaurantData } from "@/lib/restaurant-store";

export type CartLine = {
  lineId: string;
  dishId: string;
  qty: number;
};

type CartValue = {
  lines: CartLine[];
  totalQty: number;
  totalSum: number;
  addDish: (dishId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const { data } = useRestaurantData();

  const addDish = useCallback((dishId: string) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.dishId === dishId);
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        { lineId: `${dishId}-${Date.now()}`, dishId, qty: 1 },
      ];
    });
  }, []);

  const setQty = useCallback((lineId: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.lineId !== lineId);
      return prev.map((l) => (l.lineId === lineId ? { ...l, qty } : l));
    });
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const { totalQty, totalSum } = useMemo(() => {
    let q = 0;
    let s = 0;
    for (const l of lines) {
      q += l.qty;
      s += (getDishByIdFromData(data.dishes, l.dishId)?.price ?? 0) * l.qty;
    }
    return { totalQty: q, totalSum: s };
  }, [data.dishes, lines]);

  const value = useMemo(
    () => ({ lines, totalQty, totalSum, addDish, setQty, clear }),
    [lines, totalQty, totalSum, addDish, setQty, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
