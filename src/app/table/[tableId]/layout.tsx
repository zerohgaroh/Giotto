import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CartProvider } from "@/context/cart-context";
import { GuestReviewPrompt } from "@/components/guest/GuestReviewPrompt";
import { GUEST_TABLE_COOKIE, hasGuestAccessToTable, normalizeTableId } from "@/lib/guest-auth";

export default function TableLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tableId: string };
}) {
  const tableId = normalizeTableId(params.tableId);
  const guestSession = cookies().get(GUEST_TABLE_COOKIE)?.value;

  if (!tableId || !hasGuestAccessToTable(guestSession, tableId)) {
    redirect("/guest?error=invalid-link");
  }

  return (
    <CartProvider>
      {children}
      <GuestReviewPrompt tableId={tableId} />
    </CartProvider>
  );
}
