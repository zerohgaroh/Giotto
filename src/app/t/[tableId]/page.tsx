import { redirect } from "next/navigation";

/** Поддерживаем только защищенный формат ссылки: /t/[tableId]/[accessKey]. */
export default function NfcShortTablePage() {
  redirect("/guest?error=missing-access-key");
}
