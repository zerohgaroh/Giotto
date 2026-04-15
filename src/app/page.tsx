import Link from "next/link";
import { GiottoLogo } from "@/components/guest/GiottoLogo";

const DEMO_TABLES = ["1", "2", "3", "4", "5", "demo"] as const;

export default function Home() {
  return (
    <main className="motion-page mx-auto flex min-h-dvh max-w-guest flex-col bg-gradient-to-b from-giotto-cream via-giotto-paper to-giotto-paper px-6 py-12">
      <div className="flex flex-1 flex-col justify-center text-center">
        <div className="flex justify-center">
          <GiottoLogo size={112} priority />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-giotto-muted">
          Ristorante
        </p>
        <h1 className="mt-2 font-serif text-[clamp(2rem,8vw,2.75rem)] font-semibold tracking-tight text-giotto-navy-deep">
          Giotto
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-giotto-muted">
          Меню, вызов официанта и обратная связь с телефона. Откройте страницу стола — как после
          касания NFC-метки на столике.
        </p>

        <div className="mx-auto mt-10 w-full max-w-xs">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-giotto-navy-soft">
            Демо столы
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2.5">
            {DEMO_TABLES.map((id) => (
              <li key={id}>
                <Link
                  href={`/table/${id}`}
                  className="motion-action flex min-h-[3rem] items-center justify-center rounded-giotto-lg border-2 border-giotto-navy bg-white font-sans text-[14px] font-semibold text-giotto-navy shadow-lift transition hover:bg-giotto-navy hover:text-white active:scale-[0.99]"
                >
                  Стол {/^\d+$/.test(id) ? `№${id}` : id}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-xs grid-cols-2 gap-2.5">
          <Link
            href="/waiter/login"
            className="motion-action flex min-h-[2.7rem] items-center justify-center rounded-giotto-lg border border-giotto-line bg-white text-[12px] font-semibold uppercase tracking-[0.08em] text-giotto-navy"
          >
            Официант
          </Link>
          <Link
            href="/login"
            className="motion-action flex min-h-[2.7rem] items-center justify-center rounded-giotto-lg border border-giotto-line bg-white text-[12px] font-semibold uppercase tracking-[0.08em] text-giotto-navy"
          >
            Менеджер
          </Link>
        </div>

        <details className="motion-surface mx-auto mt-12 max-w-md rounded-giotto-lg border border-giotto-line bg-white/80 px-4 py-3 text-left text-[13px] text-giotto-muted backdrop-blur-sm open:shadow-lift">
          <summary className="cursor-pointer select-none font-medium text-giotto-navy-deep">
            NFC и короткая ссылка
          </summary>
          <p className="mt-3 leading-relaxed">
            На физическую метку лучше записать полный URL вида{" "}
            <span className="font-mono text-[12px] text-giotto-ink">
              https://ваш-домен/table/5
            </span>
            . Для компактной записи есть редирект{" "}
            <span className="font-mono text-[12px] text-giotto-ink">/t/5</span> → тот же экран.
          </p>
          <p className="mt-2 leading-relaxed">
            Если в Safari после перезапуска сервера «пропали» стили, закройте вкладку и откройте
            адрес снова — это кэш старых файлов <span className="font-mono text-[12px]">/_next/static</span>.
          </p>
        </details>
      </div>
    </main>
  );
}
