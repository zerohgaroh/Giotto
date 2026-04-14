"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  ClipboardList,
  Menu,
  Wifi,
  X,
} from "lucide-react";
import { tableLabelFromId } from "@/lib/table-label";
import { useRestaurantData } from "@/lib/restaurant-store";
import { GiottoLogo } from "./GiottoLogo";

type Props = { tableId: string };

function escapeWifiQrValue(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function TableHubPage({ tableId }: Props) {
  const { data } = useRestaurantData();
  const { profile } = data;
  const label = tableLabelFromId(tableId);
  const base = `/table/${tableId}`;
  const [wifiOpen, setWifiOpen] = useState(false);
  const [wifiCopied, setWifiCopied] = useState<"idle" | "password">("idle");
  const wifiName = profile.wifiName;
  const wifiPassword = profile.wifiPassword;
  const wifiQrPayload = `WIFI:T:WPA;S:${escapeWifiQrValue(wifiName)};P:${escapeWifiQrValue(wifiPassword)};H:false;;`;
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=460x460&margin=12&qzone=2&color=10-31-74&bgcolor=252-250-246&data=${encodeURIComponent(
    wifiQrPayload,
  )}`;

  const btn =
    "flex min-h-[3.7rem] w-full items-center justify-center gap-2 rounded-full border-2 border-giotto-navy bg-giotto-navy px-4 text-center font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-white transition active:scale-[0.99] hover:bg-giotto-navy-deep hover:border-giotto-navy-deep";

  const copyWifiPassword = async () => {
    try {
      await navigator.clipboard.writeText(wifiPassword);
      setWifiCopied("password");
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

      <section className="relative mt-8 overflow-hidden rounded-[2.25rem] border border-[#d8d1c3] bg-[#fcfaf6] px-6 pb-8 pt-8 shadow-[0_12px_30px_rgba(8,29,54,0.07)]">
        <svg
          aria-hidden
          viewBox="0 0 420 620"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
        >
          <path
            d="M-40 160 C 70 80, 170 245, 300 165 C 355 130, 410 145, 460 165"
            fill="none"
            stroke="rgba(10,31,74,0.13)"
            strokeWidth="2"
          />
          <path
            d="M-30 430 C 80 360, 185 520, 305 450 C 350 425, 395 430, 455 448"
            fill="none"
            stroke="rgba(10,31,74,0.12)"
            strokeWidth="2"
          />
          <path
            d="M-25 530 C 95 468, 185 620, 320 565 C 372 544, 420 550, 465 560"
            fill="none"
            stroke="rgba(184,146,74,0.16)"
            strokeWidth="1.8"
          />
        </svg>
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(184,146,74,0.16),transparent_72%)]" />

        <div className="relative flex flex-col items-center text-center">
          <div className="rounded-full bg-white p-2.5 shadow-[0_18px_38px_rgba(8,29,54,0.09)]">
            <GiottoLogo
              size={118}
              priority
              src={profile.logo}
              alt={profile.name}
              className="ring-giotto-gold/20 ring-offset-0"
            />
          </div>
          <h1 className="mt-6 font-serif text-[3rem] font-semibold uppercase leading-none tracking-[0.04em] text-giotto-navy-deep">
            {profile.name}
          </h1>
          <p className="mt-2 max-w-xs text-[12px] uppercase tracking-[0.24em] text-giotto-muted">
            {profile.subtitle}
          </p>
          <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-giotto-muted/95">
            {profile.description}
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
            <div className="mt-4 flex w-full flex-col items-center rounded-[1.2rem] border border-[#d8cfbf] bg-[linear-gradient(180deg,#fdfbf7_0%,#f6f1e7_100%)] px-4 py-4">
              <span className="rounded-full border border-giotto-navy/20 bg-white px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-giotto-navy">
                Giotto Wi‑Fi
              </span>
              <div className="mt-3 rounded-[1rem] border-2 border-giotto-navy bg-white p-2 shadow-[0_10px_22px_rgba(8,29,54,0.12)]">
                <Image
                  src={wifiQrUrl}
                  alt={`QR-код Wi‑Fi сети ${wifiName}`}
                  width={240}
                  height={240}
                  className="h-60 w-60 rounded-[0.7rem] bg-[#fcfaf6]"
                />
              </div>
              <p className="mt-3 text-center text-[13px] leading-relaxed text-giotto-muted">
                Отсканируйте QR-код камерой телефона для быстрого подключения к сети.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={copyWifiPassword}
                className="w-full rounded-giotto-lg bg-giotto-navy py-3.5 font-sans text-[14px] font-medium text-white transition hover:bg-giotto-navy-deep"
              >
                {wifiCopied === "password" ? "Пароль скопирован" : "Скопировать пароль"}
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
