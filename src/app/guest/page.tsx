import Link from "next/link";
import { GiottoLogo } from "@/components/guest/GiottoLogo";

type GuestPageProps = {
  searchParams?: {
    error?: string;
  };
};

const ERROR_TEXT: Record<string, string> = {
  "invalid-link": "Ссылка стола недействительна. Откройте страницу через NFC-метку вашего стола.",
  "missing-access-key":
    "Нужна персональная ссылка стола. Откройте страницу через NFC-метку вашего стола.",
};

export default function GuestPage({ searchParams }: GuestPageProps) {
  const error = searchParams?.error;
  const errorText = error ? ERROR_TEXT[error] : undefined;

  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest items-center px-6 py-10">
      <section className="motion-surface w-full rounded-[1.75rem] border border-giotto-line bg-white/90 p-6 text-center shadow-card backdrop-blur-sm">
        <div className="mx-auto flex w-fit items-center justify-center rounded-full bg-giotto-navy p-3.5 shadow-[0_10px_24px_rgba(13,43,107,0.2)]">
          <GiottoLogo size={64} priority className="ring-white/25" />
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-giotto-muted">
          Giotto Guest
        </p>
        <h1 className="mt-1 font-serif text-4xl font-semibold text-giotto-navy-deep">
          Экран гостя
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-giotto-muted">
          Для входа регистрация не нужна. Просто откройте персональную ссылку вашего стола
          через NFC-метку.
        </p>

        {errorText ? (
          <p className="mt-4 rounded-giotto border border-[#f2d7bf] bg-[#fff5ea] px-3 py-2 text-sm text-[#9a4f1e]">
            {errorText}
          </p>
        ) : null}

        <div className="mt-6">
          <Link
            href="/login"
            className="motion-action inline-flex h-11 items-center justify-center rounded-xl border border-giotto-line px-5 text-sm font-semibold text-giotto-navy transition hover:border-giotto-navy"
          >
            Вход для персонала
          </Link>
        </div>
      </section>
    </main>
  );
}
