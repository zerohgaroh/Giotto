import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ManagerDashboard } from "@/components/manager/manager-dashboard";
import { MANAGER_COOKIE } from "@/lib/manager-auth";

export default function ManagerPage() {
  const hasSession = cookies().get(MANAGER_COOKIE)?.value === "1";
  if (!hasSession) {
    redirect("/login");
  }

  return <ManagerDashboard />;
}
