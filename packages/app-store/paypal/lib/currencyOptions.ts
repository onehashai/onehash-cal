export const currencyOptions = [
  { label: "United States dollar", value: "USD" },
  { label: "Indian rupee", value: "INR" },
  { label: "Australian dollar", value: "AUD" },
  { label: "Brazilian real 2", value: "BRL" },
  { label: "Canadian dollar", value: "CAD" },
  { label: "Chinese Renmenbi 3", value: "CNY" },
  { label: "Czech koruna", value: "CZK" },
  { label: "Danish krone", value: "DKK" },
  { label: "Euro", value: "EUR" },
  { label: "Hong Kong dollar", value: "HKD" },
  { label: "Hungarian forint 1", value: "HUF" },
  { label: "Israeli new shekel", value: "ILS" },
  { label: "Japanese yen 1", value: "JPY" },
  { label: "Malaysian ringgit 3", value: "MYR" },
  { label: "Mexican peso", value: "MXN" },
  { label: "New Taiwan dollar 1", value: "TWD" },
  { label: "New Zealand dollar", value: "NZD" },
  { label: "Norwegian krone", value: "NOK" },
  { label: "Philippine peso", value: "PHP" },
  { label: "Polish złoty", value: "PLN" },
  { label: "Pound sterling", value: "GBP" },
  { label: "Russian ruble", value: "RUB" },
  { label: "Singapore dollar", value: "SGD" },
  { label: "Swedish krona", value: "SEK" },
  { label: "Swiss franc", value: "CHF" },
  { label: "Thai baht", value: "THB" },
] as const;

type CurrencyCode = (typeof currencyOptions)[number]["value"];

export const currencySymbols: Record<CurrencyCode, string> = {
  USD: "$",
  AUD: "$",
  BRL: "R$",
  CAD: "$",
  CNY: "¥",
  CZK: "Kč",
  DKK: "kr",
  EUR: "€",
  HKD: "$",
  HUF: "Ft",
  ILS: "₪",
  JPY: "¥",
  MYR: "RM",
  MXN: "$",
  TWD: "$",
  NZD: "$",
  NOK: "kr",
  PHP: "₱",
  PLN: "zł",
  GBP: "£",
  RUB: "₽",
  SGD: "$",
  SEK: "kr",
  CHF: "Fr",
  THB: "฿",
  INR: "₹",
};

export function isAcceptedCurrencyCode(currencyCode: string): currencyCode is CurrencyCode {
  return Object.keys(currencySymbols).includes(currencyCode);
}
