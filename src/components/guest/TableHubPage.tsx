"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  ClipboardList,
  Menu,
  MessageSquareWarning,
  Wifi,
  X,
} from "lucide-react";
import { tableLabelFromId } from "@/lib/table-label";
import { GiottoLogo } from "./GiottoLogo";

type Props = { tableId: string };

export function TableHubPage({ tableId }: Props) {
  const label = tableLabelFromId(tableId);
  const base = `/table/${tableId}`;
  const [wifiOpen, setWifiOpen] = useState(false);
  const [wifiCopied, setWifiCopied] = useState<"idle" | "password" | "all">("idle");
  const wifiName = "Giotto-Guest";
  const wifiPassword = "buonappetito";

  const btn =
    "flex min-h-[3.7rem] w-full items-center justify-center gap-2 rounded-[1.55rem] border-2 border-giotto-navy bg-white px-4 text-center font-sans text-[13px] font-semibold uppercase tracking-[0.06em] text-giotto-navy shadow-lift transition active:scale-[0.99] hover:bg-giotto-navy hover:text-white";

  const copyWifi = async (mode: "password" | "all") => {
    const text =
      mode === "password"
        ? wifiPassword
        : `Сеть: ${wifiName}\nПароль: ${wifiPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setWifiCopied(mode);
      window.setTimeout(() => setWifiCopied("idle"), 1800);
    } catch {
      setWifiCopied("idle");
    }
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-guest flex-col px-5 pb-10"
      style={{
        paddingTop: "max(1.5rem, var(--safe-top))",
        paddingBottom: "max(2rem, var(--safe-bottom))",
      }}
    >
      <header className="pt-1 text-center">
        <p className="font-sans text-[15px] font-semibold tracking-[0.02em] text-giotto-navy-deep">
          Стол {label}
        </p>
      </header>

      <section className="relative mt-8 overflow-hidden rounded-[2.3rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.78))] px-6 pb-8 pt-8 shadow-card backdrop-blur-md">
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(184,146,74,0.18),transparent_72%)]" />
        <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-giotto-gold/40 to-transparent" />

        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-full bg-white/85 p-2.5 shadow-[0_18px_38px_rgba(8,29,54,0.09)]">
            <GiottoLogo
              size={118}
              priority
              className="ring-giotto-gold/20 ring-offset-0"
            />
          </div>
          <h1 className="mt-6 font-serif text-[3.1rem] font-semibold uppercase leading-none tracking-[0.08em] text-giotto-navy-deep">
            Giotto
          </h1>
          <p className="mt-2 max-w-xs text-[13px] uppercase tracking-[0.3em] text-giotto-muted">
            Table Service
          </p>
          <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-giotto-muted">
            Меню и сервис именно для вашего стола. Всё открывается сразу после касания
            NFC-карточки.
          </p>
        </div>
      </section>

      <nav className="mt-6 flex w-full flex-col gap-3" aria-label="Сервис за столом">
        <Link href={`${base}/menu`} className={btn}>
          <Menu className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          Меню
        </Link>
        <Link href={`${base}/waiter?intent=bill`} className={btn}>
          <ClipboardList className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          Принести счёт
        </Link>
        <Link href={`${base}/waiter`} className={btn}>
          <Bell className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          Позвать официанта
        </Link>
        <Link href={`${base}/complaint`} className={btn}>
          <MessageSquareWarning className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          Жалоба
        </Link>
      </nav>

      <div className="mx-auto mt-7 flex w-full max-w-xs flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setWifiOpen(true)}
          className="inline-flex items-center gap-2 font-sans text-[14px] font-medium text-giotto-navy-soft underline decoration-giotto-gold/60 underline-offset-4 transition hover:text-giotto-navy"
        >
          <Wifi className="h-4 w-4" strokeWidth={2} />
          Wi‑Fi зала
        </button>
        <p className="max-w-xs text-center font-sans text-[11px] leading-relaxed text-giotto-muted">
          Этот экран привязан к вашему столу: номер подставляется из NFC-карточки на столе.
        </p>
      </div>

      {wifiOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-giotto-navy-deep/55"
            aria-label="Закрыть"
            onClick={() => setWifiOpen(false)}
          />
          <div className="relative m-0 w-full max-w-guest rounded-t-giotto-xl border border-giotto-line bg-white p-6 shadow-card sm:m-4 sm:rounded-giotto-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-giotto-gold">
                  Wi‑Fi
                </p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-giotto-navy-deep">
                  Сеть гостя
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWifiOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-giotto-line text-giotto-navy transition hover:bg-giotto-paper"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 font-mono text-lg font-semibold text-giotto-navy-deep">
              {wifiName}
            </p>
            <p className="mt-1 font-sans text-sm text-giotto-muted">
              Пароль: <span className="font-medium text-giotto-ink">{wifiPassword}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-giotto-muted">
              Автоподключение из браузера обычно запрещено системой. Поэтому здесь можно
              быстро скопировать пароль или все данные сети и вставить их в настройках
              Wi‑Fi.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => copyWifi("password")}
                className="w-full rounded-giotto-lg border border-giotto-line bg-white py-3.5 font-sans text-[14px] font-medium text-giotto-navy-deep transition hover:border-giotto-navy hover:bg-giotto-paper"
              >
                {wifiCopied === "password" ? "Пароль скопирован" : "Скопировать пароль"}
              </button>
              <button
                type="button"
                onClick={() => copyWifi("all")}
                className="w-full rounded-giotto-lg bg-giotto-navy py-3.5 font-sans text-[15px] font-medium text-white transition hover:bg-giotto-navy-deep"
              >
                {wifiCopied === "all" ? "Данные скопированы" : "Скопировать данные Wi‑Fi"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setWifiOpen(false)}
              className="mt-4 w-full rounded-giotto-lg border border-giotto-line bg-white py-3.5 font-sans text-[15px] font-medium text-giotto-navy-deep transition hover:border-giotto-navy hover:bg-giotto-paper"
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
