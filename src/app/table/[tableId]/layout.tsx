import { CartProvider } from "@/context/cart-context";
import { GuestReviewPrompt } from "@/components/guest/GuestReviewPrompt";

export default function TableLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tableId: string };
}) {
  return (
    <CartProvider>
      {children}
      <GuestReviewPrompt tableId={params.tableId} />
    </CartProvider>
  );
}
