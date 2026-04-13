import { CartProvider } from "@/context/cart-context";

export default function TableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
