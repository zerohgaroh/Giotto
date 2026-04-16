import { redirect } from "next/navigation";
import { WaiterDashboardPage } from "@/components/waiter/WaiterDashboardPage";
import { getWaiterSessionFromCookies } from "@/lib/waiter-backend/session";

export default async function WaiterPage() {
  const session = await getWaiterSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  return <WaiterDashboardPage waiterId={session.waiterId} />;
}
