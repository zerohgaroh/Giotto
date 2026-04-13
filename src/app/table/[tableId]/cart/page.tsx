import { CartPage } from "@/components/guest/CartPage";

export default function TableCartPage({
  params,
}: {
  params: { tableId: string };
}) {
  return <CartPage tableId={params.tableId} />;
}
