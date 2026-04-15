import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MANAGER_COOKIE } from "@/lib/manager-auth";

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const expectedEmail = (process.env.GIOTTO_MANAGER_EMAIL ?? "manager@giotto.local").toLowerCase();
  const expectedPassword = process.env.GIOTTO_MANAGER_PASSWORD ?? "manager123";

  if (email !== expectedEmail || password !== expectedPassword) {
    redirect("/login?error=invalid");
  }

  cookies().set(MANAGER_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/manager");
}

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const hasSession = cookies().get(MANAGER_COOKIE)?.value === "1";
  if (hasSession) {
    redirect("/manager");
  }

  const isInvalidCredentials = searchParams?.error === "invalid";

  return (
    <main className="motion-page mx-auto flex min-h-dvh w-full max-w-guest items-center px-6 py-10">
      <section className="motion-surface w-full rounded-giotto-xl border border-giotto-line bg-white p-6 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-giotto-muted">
          Giotto Manager
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-giotto-navy-deep">Вход</h1>
        <p className="mt-2 text-sm text-giotto-muted">
          Войдите, чтобы открыть панель менеджера на этом проекте.
        </p>

        {isInvalidCredentials ? (
          <p className="mt-4 rounded-giotto border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Неверный email или пароль.
          </p>
        ) : null}

        <form action={loginAction} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-giotto-ink">Email</span>
            <input
              name="email"
              type="email"
              required
              placeholder="manager@giotto.local"
              className="h-11 w-full rounded-giotto border border-giotto-line px-3 outline-none transition focus:border-giotto-navy"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-giotto-ink">Пароль</span>
            <input
              name="password"
              type="password"
              required
              placeholder="manager123"
              className="h-11 w-full rounded-giotto border border-giotto-line px-3 outline-none transition focus:border-giotto-navy"
            />
          </label>

          <button
            type="submit"
            className="motion-action mt-2 h-11 w-full rounded-giotto bg-giotto-navy text-sm font-semibold text-white transition hover:bg-giotto-navy-deep"
          >
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}
