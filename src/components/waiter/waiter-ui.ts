import type { ServiceRequestType, ServiceTableStatus } from "@/lib/service-store";

export const STATUS_META: Record<
  ServiceTableStatus,
  { label: string; className: string }
> = {
  free: { label: "Свободен", className: "bg-[#EAF3DE] text-[#2D6A4F]" },
  occupied: { label: "Занят", className: "bg-[#E6EFFC] text-[#1A3F8A]" },
  waiting: { label: "Ждёт официанта", className: "bg-[#F4E8D3] text-[#8A6A33]" },
  ordered: { label: "Заказал", className: "bg-[#E5ECFA] text-[#0D2B6B]" },
  bill: { label: "Просит счёт", className: "bg-[#F9E9DB] text-[#B5702A]" },
};

export const REQUEST_META: Record<
  ServiceRequestType,
  { title: string; className: string }
> = {
  waiter: { title: "Гость вызывает официанта", className: "text-[#8A6A33]" },
  bill: { title: "Гость просит счёт", className: "text-[#B5702A]" },
};

export function sourceLabel(source: "guest" | "waiter") {
  return source === "guest" ? "от гостя" : "добавил официант";
}
