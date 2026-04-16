import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WaiterTableDetailPage } from "@/components/waiter/WaiterTableDetailPage";
import { WAITER_COOKIE, findWaiterById } from "@/lib/waiter-auth";

type Props = {
  params: { tableId: string };
};

export default function WaiterTablePage({ params }: Props) {
  const waiterId = cookies().get(WAITER_COOKIE)?.value;
  if (!waiterId || !findWaiterById(waiterId)) {
    redirect("/login");
  }

  const tableId = Number(params.tableId);
  if (!Number.isFinite(tableId) || tableId <= 0) {
    redirect("/waiter");
  }

  return <WaiterTableDetailPage waiterId={waiterId} tableId={tableId} />;
}
