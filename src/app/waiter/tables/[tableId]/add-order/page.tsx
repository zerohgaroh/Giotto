import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WaiterAddOrderPage } from "@/components/waiter/WaiterAddOrderPage";
import { WAITER_COOKIE, findWaiterById } from "@/lib/waiter-auth";

type Props = {
  params: { tableId: string };
};

export default function WaiterAddOrderRoute({ params }: Props) {
  const waiterId = cookies().get(WAITER_COOKIE)?.value;
  if (!waiterId || !findWaiterById(waiterId)) {
    redirect("/login");
  }

  const tableId = Number(params.tableId);
  if (!Number.isFinite(tableId) || tableId <= 0) {
    redirect("/waiter");
  }

  return <WaiterAddOrderPage waiterId={waiterId} tableId={tableId} />;
}
