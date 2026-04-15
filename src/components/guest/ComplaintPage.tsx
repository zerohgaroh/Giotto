"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronLeft, MessageSquareWarning } from "lucide-react";
import { tableLabelFromId } from "@/lib/table-label";

type Props = { tableId: string };

export function ComplaintPage({ tableId }: Props) {
  const base = `/table/${tableId}`;
  const label = tableLabelFromId(tableId);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div
      className="motion-page mx-auto flex min-h-dvh max-w-guest flex-col bg-giotto-paper"
      style={{
        paddingTop: "max(0.75rem, var(--safe-top))",
        paddingBottom: "max(1.5rem, var(--safe-bottom))",
      }}
    >
      <header className="motion-surface border-b border-giotto-line bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={base}
            className="motion-action flex h-11 w-11 items-center justify-center rounded-full border border-giotto-line text-giotto-navy transition hover:bg-giotto-paper"
            aria-label="К столу"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-giotto-muted">
              Стол {label}
            </p>
            <h1 className="font-serif text-lg font-semibold text-giotto-navy-deep">
              Жалоба
            </h1>
          </div>
        </div>
      </header>

      {!sent ? (
        <div className="flex flex-1 flex-col px-5 pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-giotto-line bg-white shadow-lift">
            <MessageSquareWarning
              className="h-8 w-8 text-giotto-navy"
              strokeWidth={1.5}
            />
          </div>
          <div className="motion-surface mt-6 overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/75 p-5 shadow-lift backdrop-blur-sm">
            <p className="text-center text-[15px] leading-relaxed text-giotto-muted">
              Опишите ситуацию. Сообщение уйдёт администратору зала. Я добавил спокойный
              формат формы, чтобы её было удобно заполнять прямо за столом.
            </p>
            <label className="mt-6 block">
              <span className="text-sm font-semibold text-giotto-navy-deep">
                Что случилось
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Например: долгое ожидание, ошибка в блюде, проблема с сервисом..."
                className="mt-2 w-full resize-none rounded-giotto-lg border border-giotto-line bg-white px-3 py-3 text-[15px] outline-none transition focus:border-giotto-navy"
              />
            </label>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => setSent(true)}
              className="motion-action h-[52px] w-full rounded-giotto-lg bg-giotto-navy font-medium text-white transition hover:bg-giotto-navy-deep disabled:opacity-40"
            >
              Отправить
            </button>
            <Link
              href={base}
              className="motion-action py-3 text-center text-sm font-medium text-giotto-muted underline decoration-giotto-line underline-offset-4 hover:text-giotto-navy"
            >
              Отмена
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center px-6 pt-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-giotto-success/12 text-giotto-success">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-semibold text-giotto-navy-deep">
            Принято
          </h2>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-giotto-muted">
            Спасибо. При необходимости с вами свяжутся.
          </p>
          <Link
            href={base}
            className="motion-action mt-10 w-full max-w-xs rounded-giotto-lg bg-giotto-navy py-3.5 text-center font-medium text-white transition hover:bg-giotto-navy-deep"
          >
            На экран стола
          </Link>
        </div>
      )}
    </div>
  );
}
