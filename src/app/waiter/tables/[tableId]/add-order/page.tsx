import { redirect } from "next/navigation";
import { WaiterAddOrderPage } from "@/components/waiter/WaiterAddOrderPage";
import { getWaiterSessionFromCookies } from "@/lib/waiter-backend/session";

type Props = {
  params: { tableId: string };
};

export default async function WaiterAddOrderRoute({ params }: Props) {
  const session = await getWaiterSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const tableId = Number(params.tableId);
  if (!Number.isFinite(tableId) || tableId <= 0) {
    redirect("/waiter");
  }

  return <WaiterAddOrderPage tableId={tableId} />;
}
