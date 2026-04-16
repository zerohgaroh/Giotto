"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";

type Props = {
  tableId: string;
};

type RealtimeEvent = {
  type: string;
  tableId?: number;
  payload?: Record<string, unknown>;
};

function normalizeTableId(raw: string): number | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const parsed = Number(decoded.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function GuestReviewPrompt({ tableId }: Props) {
  const numericTableId = useMemo(() => normalizeTableId(tableId), [tableId]);
  const [open, setOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || expiresAt <= 0) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      setOpen(false);
      return;
    }

    const id = window.setTimeout(() => {
      setOpen(false);
    }, delay);

    return () => window.clearTimeout(id);
  }, [expiresAt, open]);

  useEffect(() => {
    const events = new EventSource("/api/realtime/stream");

    const handleDone = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeEvent;
        if (!numericTableId || payload.tableId !== numericTableId) return;

        const maybeExpiresAt = Number(payload.payload?.expiresAt ?? Date.now() + 60_000);
        setExpiresAt(Number.isFinite(maybeExpiresAt) ? maybeExpiresAt : Date.now() + 60_000);
        setRating(5);
        setComment("");
        setOpen(true);
      } catch {
        // ignore malformed events
      }
    };

    const handleSubmitted = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeEvent;
        if (!numericTableId || payload.tableId !== numericTableId) return;
        setOpen(false);
      } catch {
        // ignore malformed events
      }
    };

    events.addEventListener("waiter:done", handleDone as EventListener);
    events.addEventListener("review:submitted", handleSubmitted as EventListener);

    return () => {
      events.removeEventListener("waiter:done", handleDone as EventListener);
      events.removeEventListener("review:submitted", handleSubmitted as EventListener);
      events.close();
    };
  }, [numericTableId]);

  if (!open || !numericTableId) return null;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/table/${numericTableId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("review failed");
      }

      setOpen(false);
    } catch {
      // silent fail for smooth UX
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-giotto-navy-deep/55"
        aria-label="Закрыть"
        onClick={() => setOpen(false)}
      />
      <div className="relative m-0 w-full max-w-guest rounded-t-giotto-xl border border-giotto-line bg-white p-6 shadow-card sm:m-4 sm:rounded-giotto-lg">
        <p className="text-[11px] uppercase tracking-[0.2em] text-giotto-muted">Giotto Feedback</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-giotto-navy-deep">
          Как вас обслужили?
        </h2>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            const selected = value <= rating;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="motion-action rounded-full p-1"
                aria-label={`Оценка ${value}`}
              >
                <Star
                  className={clsx(
                    "h-8 w-8",
                    selected ? "fill-[#C8A96E] text-[#C8A96E]" : "text-[#D4D1CB]",
                  )}
                  strokeWidth={1.8}
                />
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          placeholder="Комментарий (необязательно)"
          className="motion-action mt-4 w-full resize-none rounded-xl border border-giotto-line bg-white px-3 py-2 text-[14px] outline-none focus:border-giotto-navy"
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="motion-action min-h-[2.8rem] rounded-xl border border-giotto-line bg-white text-sm font-semibold text-giotto-navy"
          >
            Пропустить
          </button>
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={submitting}
            className="motion-action min-h-[2.8rem] rounded-xl bg-giotto-navy text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Отправляем..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
