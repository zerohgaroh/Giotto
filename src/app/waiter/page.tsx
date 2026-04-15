import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WaiterDashboardPage } from "@/components/waiter/WaiterDashboardPage";
import { WAITER_COOKIE, findWaiterById } from "@/lib/waiter-auth";

export default function WaiterPage() {
  const waiterId = cookies().get(WAITER_COOKIE)?.value;
  if (!waiterId || !findWaiterById(waiterId)) {
    redirect("/waiter/login");
  }

  return <WaiterDashboardPage waiterId={waiterId} />;
}
