import axios from "axios";
import https from "https";
import { isString } from "lodash";
import memoizeOne from "memoize-one";
import { assert } from "./common";
import cryptoCurrencies from "./crypto-currencies.json";
import type { Crypto, TreasuryBrBond } from "./data-model";

interface Rate {
  date: string;
  value: number;
}

export interface InflationData {
  ipca: Rate[];
}

export interface InterestData {
  cdi: Rate[];
}

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

// HACK: required to fetch from
// https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json
// Apparently, the certificates aren't properly set for it to be fetched fro
// the server (and we can't fetch it from the client due to CORS).
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });

export const fetchTreasuryData = memoizeOne(async () => {
  const { response } = (
    await axios.get(
      "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json"
    )
  ).data;
  const treasuryBonds = (response.TrsrBdTradgList as any[]).map((bond) => ({
    name: bond.TrsrBd.nm,
    value: bond.TrsrBd.untrInvstmtVal || bond.TrsrBd.untrRedVal,
  }));
  return treasuryBonds as TreasuryBrBond[];
});

export const fetchInterestData = memoizeOne(async () => {
  const cdiRates: any[] = (
    await axios.get(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json"
    )
  ).data;
  const parseDate = (v: string) => {
    const [day, month, year] = v.split("/");
    const dateStr = `${year}-${month}-${day}`;
    const date = new Date(dateStr);
    assert(
      isString(day) &&
        isString(month) &&
        isString(year) &&
        date.toString() !== "Invalid Date",
      () => `Failed to parse ${v}`
    );
    return dateStr;
  };
  const data: InterestData = {
    cdi: cdiRates.map((v) => ({
      date: parseDate(v.data),
      value: +v.valor,
    })),
  };

  return data;
});

export const fetchInflationData = memoizeOne(async () => {
  const ipcaRates: any[] = (
    await axios.get(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json"
    )
  ).data;
  const parseDate = (v: string) => {
    const [day, month, year] = v.split("/");
    const dateStr = `${year}-${month}-${day}`;
    const date = new Date(dateStr);
    assert(
      isString(day) &&
        isString(month) &&
        isString(year) &&
        date.toString() !== "Invalid Date",
      () => `Failed to parse ${v}`
    );
    return dateStr;
  };
  const data: InflationData = {
    ipca: ipcaRates.map((v) => ({
      date: parseDate(v.data),
      value: +v.valor,
    })),
  };
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
