"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { BellRing, LogOut } from "lucide-react";
import { GiottoLogo } from "@/components/guest/GiottoLogo";
import { formatDurationFrom } from "@/lib/service-store";
import type { WaiterTablesResponse } from "@/lib/waiter-backend/types";
import { REQUEST_META, STATUS_META } from "./waiter-ui";

type Props = {
  waiterId: string;
};

export function WaiterDashboardPage({ waiterId }: Props) {
  const [now, setNow] = useState(0);
  const [data, setData] = useState<WaiterTablesResponse | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  const pull = useCallback(async () => {
    try {
      const response = await fetch("/api/waiter/me/tables", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        throw new Error("Не удалось загрузить столы");
      }
      const next = (await response.json()) as WaiterTablesResponse;
      setData(next);
      setLoadError("");
    } catch {
      setLoadError("Не удалось синхронизировать столы. Проверьте соединение.");
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void pull();

    const poll = window.setInterval(() => {
      void pull();
    }, 3000);

    const events = new EventSource("/api/realtime/stream");
    const onEvent = () => {
      void pull();
    };

    events.addEventListener("waiter:called", onEvent);
    events.addEventListener("bill:requested", onEvent);
    events.addEventListener("waiter:acknowledged", onEvent);
    events.addEventListener("table:status_changed", onEvent);

    return () => {
      window.clearInterval(poll);
      events.removeEventListener("waiter:called", onEvent);
      events.removeEventListener("bill:requested", onEvent);
      events.removeEventListener("waiter:acknowledged", onEvent);
      events.removeEventListener("table:status_changed", onEvent);
      events.close();
    };
  }, [pull]);

  const durationLabel = (startMs: number) =>
    now > 0 ? formatDurationFrom(startMs, now) : "00:00";

  const waiterName = data?.waiter.name ?? waiterId ?? "Официант";
  const myTables = data?.tables ?? [];
  const activeCallsCount = myTables.filter((table) => !!table.activeRequest).length;

  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col px-4 pb-8">
      <header
        className="motion-surface sticky top-0 z-30 -mx-4 border-b border-giotto-line/80 bg-giotto-cream/92 px-4 pb-3 pt-2 backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="flex items-center gap-3">
          <GiottoLogo size={42} priority />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-[0.2em] text-giotto-muted">
              Giotto Waiter
            </p>
            <p className="truncate text-[15px] font-semibold text-giotto-navy-deep">
              {waiterName}
            </p>
          </div>
          <Link
            href="/waiter/logout"
            className="motion-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-giotto-line bg-white text-giotto-navy"
            aria-label="Выйти"
          >
            <LogOut className="h-4.5 w-4.5" strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between">
          <h1 className="font-serif text-[2rem] font-semibold leading-none text-giotto-navy-deep">
            Мои столы
          </h1>
          <span className="rounded-full border border-[#E8D6B5] bg-[#F6ECE0] px-2.5 py-1 text-[11px] font-semibold text-[#8A6A33]">
            Вызовы: {activeCallsCount}
          </span>
        </div>

        {loadError ? (
          <div className="motion-surface mb-3 rounded-[1rem] border border-[#f2d7bf] bg-[#fff5ea] px-3 py-2 text-xs text-[#9a4f1e]">
            {loadError}
          </div>
        ) : null}

        {myTables.length === 0 ? (
          <div className="motion-surface rounded-[1.15rem] border border-giotto-line bg-white/90 p-5 text-center text-sm text-giotto-muted">
            Для вас пока нет назначенных столов.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {myTables.map((table) => {
              const meta = STATUS_META[table.status];
              const highlighted = table.status === "waiting" || table.status === "bill";
              return (
                <Link
                  key={table.tableId}
                  href={`/waiter/tables/${table.tableId}`}
                  className={clsx(
                    "motion-action motion-surface rounded-[1.1rem] bg-[#FAF7F2] px-3 pb-3 pt-2.5 shadow-[0_2px_12px_rgba(13,43,107,0.08)]",
                    highlighted
                      ? "border-2 border-[#C8A96E] animate-[giotto-waiter-pulse_2.2s_ease-in-out_infinite]"
                      : "border border-[#D4D1CB]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-giotto-navy-deep">
                      Стол {table.tableId}
                    </p>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
                      {meta.label}
                    </span>
                  </div>

                  <p className="mt-2 text-[12px] text-giotto-muted">{waiterName}</p>
                  <p className="mt-0.5 font-mono text-[12px] font-semibold text-giotto-navy-deep">
                    ⏱ {durationLabel(table.guestStartedAt)}
                  </p>

                  {table.activeRequest ? (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-[#FFF7EA] px-2 py-1.5 text-[11px] text-[#8A6A33]">
                      <BellRing className="h-3.5 w-3.5" strokeWidth={1.7} />
                      <span className="line-clamp-2 leading-tight">
                        {REQUEST_META[table.activeRequest.type].title}
                      </span>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
