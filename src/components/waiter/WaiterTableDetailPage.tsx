"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { BellRing, Check, ChevronLeft } from "lucide-react";
import { formatPriceUZS } from "@/lib/format";
import { formatDurationFrom, formatMinutesAgo } from "@/lib/service-store";
import type { WaiterTableDetailResponse } from "@/lib/waiter-backend/types";
import { REQUEST_META, sourceLabel, STATUS_META } from "./waiter-ui";

type Props = {
  tableId: number;
};

export function WaiterTableDetailPage({ tableId }: Props) {
  const [data, setData] = useState<WaiterTableDetailResponse | null>(null);
  const [now, setNow] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [errorText, setErrorText] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const pull = useCallback(async () => {
    try {
      const response = await fetch(`/api/waiter/tables/${tableId}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.status === 403 || response.status === 404) {
        setForbidden(true);
        return;
      }
      if (!response.ok) throw new Error("Не удалось загрузить стол");

      const next = (await response.json()) as WaiterTableDetailResponse;
      setData(next);
      setNoteDraft(next.note ?? "");
      setErrorText("");
      setForbidden(false);
    } catch {
      setErrorText("Не удалось обновить данные стола.");
    }
  }, [tableId]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void pull();

    const poll = window.setInterval(() => {
      void pull();
    }, 2500);

    const events = new EventSource("/api/realtime/stream");
    const onEvent = () => {
      void pull();
    };

    events.addEventListener("waiter:called", onEvent);
    events.addEventListener("bill:requested", onEvent);
    events.addEventListener("waiter:acknowledged", onEvent);
    events.addEventListener("order:added_by_waiter", onEvent);
    events.addEventListener("table:status_changed", onEvent);

    return () => {
      window.clearInterval(poll);
      events.removeEventListener("waiter:called", onEvent);
      events.removeEventListener("bill:requested", onEvent);
      events.removeEventListener("waiter:acknowledged", onEvent);
      events.removeEventListener("order:added_by_waiter", onEvent);
      events.removeEventListener("table:status_changed", onEvent);
      events.close();
    };
  }, [pull]);

  const table = data?.table;
  const waiter = data?.waiter;
  const requests = useMemo(() => data?.requests ?? [], [data?.requests]);
  const billLines = useMemo(() => data?.billLines ?? [], [data?.billLines]);

  const total = useMemo(
    () => billLines.reduce((sum, line) => sum + line.qty * line.price, 0),
    [billLines],
  );

  const doneCooldownLeft = useMemo(() => {
    if (!table) return 0;
    return Math.max(0, (table.doneCooldownUntil ?? 0) - now);
  }, [now, table]);

  if (forbidden) {
    return (
      <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col items-center justify-center px-5 text-center">
        <h1 className="font-serif text-3xl font-semibold text-giotto-navy-deep">Нет доступа</h1>
        <p className="mt-3 max-w-sm text-sm text-giotto-muted">
          Этот стол не назначен вам. Проверьте список столов или обратитесь к менеджеру.
        </p>
        <Link
          href="/waiter"
          className="motion-action mt-6 inline-flex min-h-[2.8rem] items-center justify-center rounded-xl border border-giotto-line px-5 text-sm font-semibold text-giotto-navy"
        >
          Вернуться к моим столам
        </Link>
      </main>
    );
  }

  if (!table || !waiter) {
    return (
      <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col items-center justify-center px-5 text-center text-sm text-giotto-muted">
        Загрузка данных стола...
      </main>
    );
  }

  const durationLabel = (startMs: number) =>
    now > 0 ? formatDurationFrom(startMs, now) : "00:00";
  const requestTimeLabel = (timeMs: number) =>
    now > 0
      ? new Date(timeMs).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";
  const minutesAgoLabel = (timeMs: number) =>
    now > 0 ? formatMinutesAgo(timeMs, now) : "—";

  const statusMeta = STATUS_META[table.status];
  const cooldownLabel = `${Math.floor(doneCooldownLeft / 1000)}с`;

  const acknowledge = async (requestId: string) => {
    try {
      const response = await fetch(`/api/waiter/tables/${tableId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (!response.ok) throw new Error("ack failed");
      const next = (await response.json()) as WaiterTableDetailResponse;
      setData(next);
      setNoteDraft(next.note ?? "");
      setErrorText("");
    } catch {
      setErrorText("Не удалось подтвердить вызов.");
    }
  };

  const saveNote = async () => {
    try {
      const response = await fetch(`/api/waiter/tables/${tableId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteDraft }),
      });
      if (!response.ok) throw new Error("note failed");
      const next = (await response.json()) as WaiterTableDetailResponse;
      setData(next);
      setNoteDraft(next.note ?? "");
    } catch {
      setErrorText("Не удалось сохранить заметку.");
    }
  };

  const markDone = async () => {
    try {
      const response = await fetch(`/api/waiter/tables/${tableId}/done`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("done failed");
      const next = (await response.json()) as WaiterTableDetailResponse;
      setData(next);
      setNoteDraft(next.note ?? "");
      setErrorText("");
    } catch {
      setErrorText("Не удалось завершить обслуживание.");
    }
  };

  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest flex-col px-4 pb-[calc(6.8rem+var(--safe-bottom))]">
      <header
        className="motion-surface sticky top-0 z-30 -mx-4 border-b border-giotto-line/80 bg-giotto-cream/92 px-4 pb-3 pt-2 backdrop-blur-md"
        style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Link
            href="/waiter"
            className="motion-action inline-flex h-10 w-10 items-center justify-center rounded-full border border-giotto-line bg-white text-giotto-navy"
            aria-label="Назад"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </Link>

          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-giotto-muted">Стол {tableId}</p>
            <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", statusMeta.className)}>
              {statusMeta.label}
            </span>
          </div>

          <p className="font-mono text-[12px] font-semibold text-giotto-navy-deep">
            {durationLabel(table.guestStartedAt)}
          </p>
        </div>
      </header>

      {errorText ? (
        <div className="mt-3 rounded-lg border border-[#f2d7bf] bg-[#fff5ea] px-3 py-2 text-xs text-[#9a4f1e]">
          {errorText}
        </div>
      ) : null}

      {requests.length > 0 ? (
        <section className="mt-4 space-y-2">
          {requests.map((request) => (
            <article
              key={request.id}
              className="motion-surface rounded-[1rem] border border-[#E8D6B5] bg-[#FFF8EC] p-3"
            >
              <div className="flex items-start gap-2">
                <BellRing className="mt-0.5 h-4.5 w-4.5 text-[#8A6A33]" strokeWidth={1.7} />
                <div className="min-w-0 flex-1">
                  <p className={clsx("text-sm font-semibold", REQUEST_META[request.type].className)}>
                    {REQUEST_META[request.type].title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-giotto-muted">Причина: {request.reason}</p>
                  <p className="mt-0.5 text-[11px] text-giotto-muted">
                    {requestTimeLabel(request.createdAt)}
                    {" · "}
                    {minutesAgoLabel(request.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void acknowledge(request.id);
                }}
                className="motion-action mt-2.5 inline-flex min-h-[2.4rem] items-center justify-center rounded-[0.85rem] bg-[#C8A96E] px-4 text-[13px] font-semibold text-giotto-navy-deep"
              >
                Принято — иду
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className="motion-surface mt-4 rounded-[1.1rem] border border-[#E3DCCF] bg-white/88 p-4">
        <h2 className="font-serif text-[1.35rem] italic text-giotto-navy-deep">Счёт стола</h2>

        {billLines.length === 0 ? (
          <p className="mt-2 text-sm text-giotto-muted">Пока нет позиций.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {billLines.map((line) => (
              <div key={line.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] text-giotto-ink">
                    {line.title} × {line.qty}
                  </p>
                  <p className="shrink-0 text-[14px] font-semibold text-giotto-navy-deep">
                    {formatPriceUZS(line.price * line.qty)}
                  </p>
                </div>
                {line.note ? (
                  <p className="text-[11px] text-giotto-muted">↳ {line.note}</p>
                ) : null}
                <p className="text-[11px] text-[#8C8880]">[{sourceLabel(line.source)}]</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-giotto-line pt-3">
          <p className="text-[15px] font-semibold text-giotto-navy-deep">Итого: {formatPriceUZS(total)}</p>
        </div>

        <Link
          href={`/waiter/tables/${tableId}/add-order`}
          className="motion-action mt-3 inline-flex min-h-[2.65rem] items-center justify-center rounded-[0.9rem] border border-giotto-navy px-4 text-[13px] font-semibold text-giotto-navy"
        >
          Добавить заказ
        </Link>
      </section>

      <section className="motion-surface mt-4 rounded-[1rem] border border-giotto-line bg-white/80 p-3.5">
        <label className="block text-sm font-semibold text-giotto-navy-deep">
          Заметки (видны только вам)
        </label>
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          onBlur={() => {
            void saveNote();
          }}
          rows={3}
          placeholder="аллергия на орехи, VIP, день рождения..."
          className="motion-action mt-2 w-full resize-none rounded-xl border border-giotto-line bg-white px-3 py-2 text-[14px] outline-none focus:border-giotto-navy"
        />
      </section>

      <div
        className="motion-surface fixed inset-x-0 bottom-0 z-40 border-t border-giotto-line bg-giotto-cream/96 px-4 py-3 backdrop-blur-md"
        style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
      >
        <div className="mx-auto max-w-guest">
          <button
            type="button"
            disabled={doneCooldownLeft > 0}
            onClick={() => {
              void markDone();
            }}
            className="motion-action flex h-[3rem] w-full items-center justify-center gap-1.5 rounded-[0.95rem] bg-[#C8A96E] text-[14px] font-semibold text-giotto-navy-deep disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Check className="h-4.5 w-4.5" strokeWidth={1.9} />
            {doneCooldownLeft > 0 ? `Повтор через ${cooldownLabel}` : "Все обслужил"}
          </button>
          <p className="mt-1 text-center text-[11px] text-giotto-muted">
            Официант: {waiter.name}
          </p>
        </div>
      </div>
    </main>
  );
}
