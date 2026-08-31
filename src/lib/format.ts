const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const number4 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

export const fmtNum = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "—" : number.format(Number(n));

export const fmtTonnes = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "—" : `${number4.format(Number(n))} tCO₂e`;

export const fmtVnd = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "—" : currency.format(Number(n));

export const fmtDate = (d: string | null | undefined) =>
  d ? date.format(new Date(d)) : "—";

export const fmtHa = (n: number | string | null | undefined) =>
  n === null || n === undefined ? "—" : `${number4.format(Number(n))} ha`;
