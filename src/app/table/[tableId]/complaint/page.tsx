import { ComplaintPage } from "@/components/guest/ComplaintPage";

export default function TableComplaintPage({
  params,
}: {
  params: { tableId: string };
}) {
  return <ComplaintPage tableId={params.tableId} />;
}
