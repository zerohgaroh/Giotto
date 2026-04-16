import { redirect } from "next/navigation";
import { WaiterTableDetailPage } from "@/components/waiter/WaiterTableDetailPage";
import { getWaiterSessionFromCookies } from "@/lib/waiter-backend/session";

type Props = {
  params: { tableId: string };
};

export default async function WaiterTablePage({ params }: Props) {
  const session = await getWaiterSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const tableId = Number(params.tableId);
  if (!Number.isFinite(tableId) || tableId <= 0) {
    redirect("/waiter");
  }

  return <WaiterTableDetailPage tableId={tableId} />;
}
