export function tableLabelFromId(tableId: string) {
  const t = decodeURIComponent(tableId).trim();
  if (/^\d+$/.test(t)) return `№${t}`;
  return t || "—";
}
