import { Suspense } from "react";
import { WaiterTimerPage } from "@/components/guest/WaiterTimerPage";

function Fallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-giotto-paper font-sans text-giotto-muted">
      Загрузка…
    </div>
  );
}

export default function WaiterPage({
  params,
}: {
  params: { tableId: string };
}) {
  return (
    <Suspense fallback={<Fallback />}>
      <WaiterTimerPage tableId={params.tableId} />
    </Suspense>
  );
}
