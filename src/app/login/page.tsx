import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest items-center justify-center px-6 py-10">
      <section className="motion-surface w-full rounded-[1.75rem] border border-[#D9D2C6] bg-white/94 p-6 shadow-card backdrop-blur-sm">
        <p className="text-[11px] uppercase tracking-[0.24em] text-giotto-muted">Giotto Staff</p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold text-giotto-navy-deep">
          Staff Web Deprecated
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-giotto-muted">
          Интерфейс официанта и менеджера перенесён в мобильное приложение `giotto-app`.
          Этот веб-маршрут больше не используется как продуктовый staff UI.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/guest"
            className="motion-action inline-flex h-11 items-center justify-center rounded-xl bg-[#0D2B6B] text-sm font-semibold text-white"
          >
            Перейти на guest сайт
          </Link>
          <p className="text-xs text-giotto-muted">
            Для staff-входа используйте мобильное приложение и `api/staff/*`.
          </p>
        </div>
      </section>
    </main>
  );
}
