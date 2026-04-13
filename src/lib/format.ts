export function formatPriceUZS(sum: number) {
  return `${new Intl.NumberFormat("ru-RU").format(sum)} so'm`;
}
