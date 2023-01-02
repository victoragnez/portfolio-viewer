import memoizeOne from "memoize-one";
import type { InflationData } from "../pages/api/inflation-data";
import type { InterestData } from "../pages/api/interest-data";
import cryptoCurrencies from "./crypto-currencies.json";
import type { Crypto, TreasuryBrBond } from "./data-model";

export const fetchCryptoCurrencies = memoizeOne(async () => {
  const cryptoCurrencyNames = Object.fromEntries(
    cryptoCurrencies.map((coin) => [
      coin.symbol,
      { name: coin.name, id: coin.id },
    ])
  ) as Record<Crypto, { name: string; id: string }>;
  const availableCryptoCurrencies = [
    ...Object.keys(cryptoCurrencyNames),
  ] as Crypto[];
  const availableCryptoCurrenciesSet = new Set(availableCryptoCurrencies);
  return {
    cryptoCurrencyNames,
    availableCryptoCurrencies,
    availableCryptoCurrenciesSet,
  };
});

export const fetchTreasuryData = memoizeOne(async () => {
  const { data: treasuryBonds } = await (
    await fetch("http://localhost:3000/api/treasury-data")
  ).json();
  return treasuryBonds as TreasuryBrBond[];
});

export const fetchInterestData = memoizeOne(async () => {
  const data: InterestData = await (
    await fetch("http://localhost:3000/api/interest-data")
  ).json();
  return data;
});

export const fetchInflationData = memoizeOne(async () => {
  const data: InflationData = await (
    await fetch("http://localhost:3000/api/inflation-data")
  ).json();
  return data;
});

export const fetchUsdPrice = memoizeOne(
  async () =>
    +(
      await (
        await fetch(`https://economia.awesomeapi.com.br/json/last/USD`)
      ).json()
    )[`USDBRL`].ask as number
);
