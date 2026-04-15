import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WAITER_COOKIE } from "@/lib/waiter-auth";

export default function WaiterLogoutPage() {
  cookies().delete(WAITER_COOKIE);
  redirect("/waiter/login");
}
