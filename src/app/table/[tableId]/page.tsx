import { TableHubPage } from "@/components/guest/TableHubPage";

export default function TablePage({
  params,
}: {
  params: { tableId: string };
}) {
  return <TableHubPage tableId={params.tableId} />;
}
