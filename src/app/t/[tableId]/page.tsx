import { redirect } from "next/navigation";

/** Короткая ссылка для NFC-тега: меньше данных в NDEF, тот же экран стола. */
export default function NfcShortTablePage({
  params,
}: {
  params: { tableId: string };
}) {
  redirect(`/table/${encodeURIComponent(params.tableId)}`);
}
