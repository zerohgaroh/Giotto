import { tableLabelFromId } from "../../lib/table-label";

export type TableHubProfile = {
  name: string;
  subtitle: string;
  description: string;
  logo: string;
  wifiName: string;
  wifiPassword: string;
};

export type TableHubAction = {
  href: string;
  label: string;
  icon: "menu" | "bill" | "waiter";
};

export type TableHubViewModel = {
  tableId: string;
  tableLabel: string;
  basePath: string;
  profile: TableHubProfile;
  wifiQrUrl: string;
  actions: TableHubAction[];
};

function escapeWifiQrValue(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function buildTableHubViewModel(tableId: string, profile: TableHubProfile): TableHubViewModel {
  const basePath = `/table/${tableId}`;
  const wifiQrPayload = `WIFI:T:WPA;S:${escapeWifiQrValue(profile.wifiName)};P:${escapeWifiQrValue(profile.wifiPassword)};H:false;;`;
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=460x460&margin=12&qzone=2&color=10-31-74&bgcolor=252-250-246&data=${encodeURIComponent(
    wifiQrPayload,
  )}`;

  return {
    tableId,
    tableLabel: tableLabelFromId(tableId),
    basePath,
    profile,
    wifiQrUrl,
    actions: [
      { href: `${basePath}/menu`, label: "Меню", icon: "menu" },
      { href: `${basePath}/waiter?intent=bill`, label: "Принести счёт", icon: "bill" },
      { href: `${basePath}/waiter`, label: "Позвать официанта", icon: "waiter" },
    ],
  };
}
