"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BellRing } from "lucide-react";
import type { CooldownState } from "@/lib/waiter-backend/types";
import { tableLabelFromId } from "@/lib/table-label";

type Props = { tableId: string };

const WAIT_SEC = 120;
const R = 50;
const CIRC = 2 * Math.PI * R;

function formatCountdown(total: number) {
  const safe = Math.max(total, 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WaiterTimerPage({ tableId }: Props) {
  const search = useSearchParams();
  const intent = search.get("intent");
  const isBill = intent === "bill";

  const label = tableLabelFromId(tableId);
  const base = `/table/${tableId}`;
  const actionLabel = isBill ? "Принести счёт" : "Позвать официанта";
  const requestType = isBill ? "bill" : "waiter";

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expiresAt, setExpiresAt] = useState(0);
  const [timerError, setTimerError] = useState("");
  const timerDetailsRef = useRef<HTMLDivElement>(null);
  const [timerDetailsHeight, setTimerDetailsHeight] = useState<number | null>(null);

  const remaining = Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  const requested = remaining > 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const syncCooldown = useCallback(async () => {
    try {
      const response = await fetch(`/api/table/${tableId}/request?type=${requestType}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("cooldown sync failed");
      const payload = (await response.json()) as { cooldown?: CooldownState };
      setExpiresAt(payload.cooldown?.availableAt ?? 0);
      setTimerError("");
    } catch {
      setTimerError("Не удалось проверить состояние вызова.");
    }
  }, [requestType, tableId]);

  useEffect(() => {
    void syncCooldown();
  }, [syncCooldown]);

  useLayoutEffect(() => {
    const node = timerDetailsRef.current;
    if (!node) return;
    setTimerDetailsHeight(node.scrollHeight);
  }, []);

  useEffect(() => {
    const node = timerDetailsRef.current;
    if (!node) return;
    setTimerDetailsHeight(node.scrollHeight);
  }, [requested]);

  const progress = useMemo(() => {
    if (!requested) return 0;
    return Math.min(1, Math.max(0, remaining / WAIT_SEC));
  }, [remaining, requested]);

  const dashOffset = CIRC * (1 - progress);
  const canRecall = remaining === 0;
  const ringSize = "h-[min(68vmin,15rem)] w-[min(68vmin,15rem)]";

  const sendRequest = useCallback(async () => {
    try {
      const response = await fetch(`/api/table/${tableId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: requestType }),
      });
      if (!response.ok) throw new Error("request failed");
      const payload = (await response.json()) as {
        cooldown?: CooldownState;
      };
      setExpiresAt(payload.cooldown?.availableAt ?? 0);
      setNowMs(Date.now());
      setTimerError("");
    } catch {
      setTimerError("Не удалось отправить вызов. Попробуйте ещё раз.");
    }
  }, [requestType, tableId]);

  return (
    <div
      className="motion-page mx-auto flex min-h-dvh max-w-guest flex-col px-5 pb-8"
      style={{
        paddingTop: "max(1.25rem, var(--safe-top))",
        paddingBottom: "max(1.5rem, var(--safe-bottom))",
      }}
    >
      <header className="text-center">
        <p className="font-sans text-[clamp(15px,4.2vw,17px)] font-bold tracking-tight text-giotto-navy-deep">
          Стол {label}
        </p>
        <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-giotto-muted">
          {isBill ? "Запрос счёта" : "Ожидайте официанта"}
        </p>
      </header>

      <section className="motion-surface relative mt-5 overflow-hidden rounded-[2.2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.86))] px-5 pb-8 pt-6 shadow-card backdrop-blur-md">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(184,146,74,0.14),transparent_72%)]" />
        <div className="text-center">
          <span className="inline-flex rounded-full border border-giotto-gold/35 bg-giotto-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-giotto-navy-deep">
            {requested
              ? isBill
                ? "Запрос счёта"
                : "Вызов отправлен"
              : "Сервис за столом"}
          </span>
          <h1 className="mt-2 font-serif text-[2.15rem] font-semibold leading-none text-giotto-navy-deep">
            {requested
              ? isBill
                ? "Готовим счёт"
                : "Официант вызван"
              : actionLabel}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-giotto-muted">
            {requested
              ? isBill
                ? "Повторный запрос счёта будет доступен через 2 минуты."
                : "Повторно позвать официанта можно только после окончания таймера."
              : "Нажмите кнопку ниже, чтобы отправить запрос именно по вашему столу."}
          </p>
        </div>

        <div className="mx-auto mt-8 flex flex-col items-center">
          <div className={`relative ${ringSize}`}>
            <svg
              width="256"
              height="256"
              viewBox="0 0 128 128"
              className={`${ringSize} drop-shadow-[0_18px_36px_rgba(8,29,54,0.05)]`}
              aria-hidden
            >
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke="#dde2ea"
                strokeWidth="10"
              />
              {requested ? (
                <circle
                  cx="64"
                  cy="64"
                  r={R}
                  fill="none"
                  stroke="#0a1f4a"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 64 64)"
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              ) : null}
              <circle
                cx="64"
                cy="64"
                r="34"
                fill="white"
                stroke="#ebe6dc"
                strokeWidth="1.5"
              />
            </svg>

            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="flex h-[clamp(4.6rem,20vmin,5.35rem)] w-[clamp(4.6rem,20vmin,5.35rem)] items-center justify-center rounded-full bg-white">
                <BellRing
                  className="h-[clamp(2.3rem,10.5vmin,2.75rem)] w-[clamp(2.3rem,10.5vmin,2.75rem)] text-giotto-navy-deep"
                  strokeWidth={1.45}
                  aria-hidden
                />
              </span>
            </div>
          </div>

          <div
            className="mt-6 overflow-hidden text-center transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={
              timerDetailsHeight === null
                ? undefined
                : { height: `${timerDetailsHeight}px` }
            }
          >
            <div ref={timerDetailsRef}>
              {requested ? (
                <>
                  <p
                    className="font-mono text-[clamp(2.9rem,14vw,3.5rem)] font-semibold tabular-nums tracking-[-0.04em] text-giotto-navy-deep"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {formatCountdown(remaining)}
                  </p>
                  <span className="mt-1 block font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-giotto-muted">
                    до повторного вызова
                  </span>
                </>
              ) : (
                <span className="block font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-giotto-muted">
                  Таймер начнётся после нажатия
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {timerError ? (
        <div className="mt-3 rounded-lg border border-[#f2d7bf] bg-[#fff5ea] px-3 py-2 text-xs text-[#9a4f1e]">
          {timerError}
        </div>
      ) : null}

      <div className="mx-auto mt-auto flex w-full max-w-xs flex-col gap-3 pt-[clamp(2rem,8vh,3.5rem)]">
        <button
          type="button"
          onClick={() => {
            void sendRequest();
          }}
          disabled={requested && !canRecall}
          className="motion-action min-h-[3.5rem] w-full rounded-[1.45rem] border-2 border-giotto-navy bg-giotto-navy font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-white shadow-lift transition hover:bg-giotto-navy-deep active:scale-[0.99] motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-[#a7b2c8] disabled:bg-[#a7b2c8] disabled:text-white/80 disabled:shadow-none disabled:hover:bg-[#a7b2c8]"
        >
          {actionLabel}
        </button>
        <Link
          href={base}
          className="motion-action flex min-h-[3.2rem] w-full items-center justify-center rounded-[1.35rem] border border-giotto-line bg-white/92 font-sans text-[14px] font-medium text-giotto-navy-deep backdrop-blur-sm transition hover:border-giotto-navy"
        >
          На экран стола
        </Link>
      </div>
    </div>
  );
}
