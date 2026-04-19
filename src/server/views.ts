import { getRestaurantData } from "../lib/staff-backend/restaurant";
import { tableLabelFromId } from "../lib/table-label";
import type { RestaurantData } from "../lib/types";

function escapeWifiQrValue(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export async function loadRestaurantViewModel() {
  const restaurant = await getRestaurantData();
  return {
    restaurant,
    profile: restaurant.profile,
  };
}

export async function loadTableViewModel(tableId: string) {
  const restaurant = await getRestaurantData();
  const wifiQrPayload = `WIFI:T:WPA;S:${escapeWifiQrValue(restaurant.profile.wifiName)};P:${escapeWifiQrValue(
    restaurant.profile.wifiPassword,
  )};H:false;;`;
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=460x460&margin=12&qzone=2&color=10-31-74&bgcolor=252-250-246&data=${encodeURIComponent(
    wifiQrPayload,
  )}`;

  return {
    restaurant,
    profile: restaurant.profile,
    tableId,
    tableLabel: tableLabelFromId(tableId),
    wifiQrUrl,
  };
}

export function dishMapById(restaurant: RestaurantData) {
  return Object.fromEntries(restaurant.dishes.map((dish) => [dish.id, dish]));
}
