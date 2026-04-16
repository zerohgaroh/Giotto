import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ManagerDashboard } from "@/components/manager/manager-dashboard";
import { MANAGER_COOKIE, parseManagerToken } from "@/lib/manager-auth";
import { findManagerById } from "@/lib/waiter-backend/backend";

export default async function ManagerPage() {
  const token = cookies().get(MANAGER_COOKIE)?.value;
  const session = parseManagerToken(token);
  if (!session) {
    redirect("/login");
  }

  const manager = await findManagerById(session.managerId);
  if (!manager) {
    redirect("/login");
  }

  return <ManagerDashboard />;
}
