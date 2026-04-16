import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GiottoLogo } from "@/components/guest/GiottoLogo";
import {
  MANAGER_COOKIE,
  issueManagerToken,
  managerCookieOptions,
  parseManagerToken,
} from "@/lib/manager-auth";
import {
  authenticateManagerCredentials,
  authenticateWaiterCredentials,
  findManagerById,
  findWaiterById,
} from "@/lib/waiter-backend/backend";
import {
  WAITER_COOKIE,
  issueWaiterToken,
  parseWaiterToken,
  waiterCookieOptions,
} from "@/lib/waiter-auth";

async function loginAction(formData: FormData) {
  "use server";

  const login = String(formData.get("login") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const waiter = await authenticateWaiterCredentials(login, password);
  if (waiter) {
    cookies().set(WAITER_COOKIE, issueWaiterToken(waiter.id), waiterCookieOptions());
    cookies().delete(MANAGER_COOKIE);
    redirect("/waiter");
  }

  const manager = await authenticateManagerCredentials(login, password);
  if (!manager) {
    redirect("/login?error=invalid");
  }

  cookies().set(MANAGER_COOKIE, issueManagerToken(manager.id), managerCookieOptions());
  cookies().delete(WAITER_COOKIE);

  redirect("/manager");
}

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const managerToken = cookies().get(MANAGER_COOKIE)?.value;
  const managerSession = parseManagerToken(managerToken);
  if (managerSession) {
    const manager = await findManagerById(managerSession.managerId);
    if (manager) {
      redirect("/manager");
    }
  }

  const waiterToken = cookies().get(WAITER_COOKIE)?.value;
  const waiterSession = parseWaiterToken(waiterToken);
  if (waiterSession) {
    const waiter = await findWaiterById(waiterSession.waiterId);
    if (waiter) redirect("/waiter");
  }

  const isInvalidCredentials = searchParams?.error === "invalid";

  return (
    <main className="motion-page relative mx-auto flex min-h-dvh w-full max-w-guest items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(13,43,107,0.18),transparent_45%),linear-gradient(180deg,#faf7f2_0%,#f4efe6_100%)]" />

      <section className="motion-surface w-full rounded-[1.75rem] border border-[#D9D2C6] bg-white/94 p-6 shadow-card backdrop-blur-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="rounded-full bg-[#0D2B6B] p-3.5 shadow-[0_10px_28px_rgba(13,43,107,0.2)]">
            <GiottoLogo size={64} priority className="ring-white/25" />
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-giotto-muted">
            Giotto Staff
          </p>
          <h1 className="mt-1 font-serif text-[2rem] font-semibold text-giotto-navy-deep">
            Единый вход
          </h1>
          <p className="mt-2 text-sm text-giotto-muted">
            Официант и менеджер входят через один экран.
          </p>
        </div>

        {isInvalidCredentials ? (
          <p className="mb-3 text-sm text-[#B42318]">Неверный логин или пароль.</p>
        ) : null}

        <form action={loginAction} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-giotto-ink">
              Логин или email
            </span>
            <input
              name="login"
              type="text"
              required
              placeholder="manager или marco"
              className="motion-action h-11 w-full rounded-xl border border-giotto-line px-3 outline-none focus:border-giotto-navy"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-giotto-ink">
              Пароль
            </span>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="motion-action h-11 w-full rounded-xl border border-giotto-line px-3 outline-none focus:border-giotto-navy"
            />
          </label>

          <button
            type="submit"
            className="motion-action h-11 w-full rounded-xl bg-[#0D2B6B] text-sm font-semibold text-white hover:bg-[#0A2257]"
          >
            Войти
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-giotto-muted">
          Свяжитесь с менеджером для получения доступа
        </p>
      </section>
    </main>
  );
}
