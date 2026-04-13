import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MANAGER_COOKIE } from "@/lib/manager-auth";

export default function ManagerLogoutPage() {
  cookies().delete(MANAGER_COOKIE);
  redirect("/login");
}
