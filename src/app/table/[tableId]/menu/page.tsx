import { Suspense } from "react";
import { TableMenuView } from "@/components/guest/TableMenuView";

function MenuFallback() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-giotto-cream to-giotto-paper font-sans text-sm text-giotto-muted"
      aria-busy="true"
    >
      Меню…
    </div>
  );
}

export default function MenuPage({
  params,
}: {
  params: { tableId: string };
}) {
  return (
    <Suspense fallback={<MenuFallback />}>
      <TableMenuView tableId={params.tableId} />
    </Suspense>
  );
}
