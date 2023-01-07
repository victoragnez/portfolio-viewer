import distinctColors from "distinct-colors";
import { isFinite, isString, pick } from "lodash";
import { makeObservable, observable } from "mobx";
import { DeepReadonly, Opaque } from "ts-essentials";
import yahooFinance from "yahoo-finance2-internal";
import {
  availableCurrencies,
  availableCurrenciesSet,
  currencyNames,
} from "./available-currencies";
import { assert, assertNever, shuffleArray } from "./common";
import {
  fetchCryptoCurrencies,
  fetchInflationData,
  fetchInterestData,
  fetchTreasuryData,
  fetchUsdPrice,
} from "./fetch-data";
const CoinGecko = require("coingecko-api");

export type Crypto = Opaque<string, "Crypto">;
export type TreasuryBrBondName = Opaque<string, "TreasuryBrBondName">;

export interface TreasuryBrBond {
  name: TreasuryBrBondName;
  value: number;
}

interface CashReserve {
  type: "cash-reserve";
  currency: typeof availableCurrencies[number];
  qty: number;
}

type PrivateCreditBr = {
  type: "private-credit-br";
  name: string;
  start: string;
  end: string;
  investedAmount: number;
} & (
  | {
      prefixedRate: number; // annual %
      ipca?: boolean; // whether it is inflation-protected
      cdi?: undefined;
    }
  | {
      prefixedRate?: number; // annual %
      ipca?: undefined;
      cdi: number; // % of CDI
    }
);

interface TreasuryBr {
  type: "treasury-br";
  name: TreasuryBrBondName;
  qty: number;
}

interface SharesBr {
  type: "shares-br";
  ticker: string;
  qty: number;
}

interface SharesUs {
  type: "shares-us";
  ticker: string;
  qty: number;
}

interface CryptoCurrency {
  type: "crypto-currency";
  ticker: Crypto;
  qty: number;
}

export type Asset =
  | CashReserve
  | PrivateCreditBr
  | TreasuryBr
  | SharesBr
  | SharesUs
  | CryptoCurrency;

export interface AssetGroup {
  name: string;
  entries: AssetEntry[];
}

export type AssetEntry = AssetGroup | Asset;

export function isIndividualAsset(entry: AssetEntry): entry is Asset {
  return !!entry && "type" in entry && !!entry.type;
}

export function isAssetGroup(entry: AssetEntry): entry is AssetGroup {
  return !!entry && "entries" in entry && !!entry.entries;
}

export type Node = GroupNode | AssetNode;

type Color = Opaque<string, "Color">;

type NodeChild = [Node, Color];

interface GroupNodeParams {
  name: string;
  value: number;
  path: readonly string[];
  group: AssetGroup;
  children: readonly NodeChild[];
}

export class GroupNode {
  readonly name: string;
  readonly value: number;
  isOpen: boolean;
  readonly group: DeepReadonly<AssetGroup>;
  readonly path: readonly string[];
  readonly children: readonly NodeChild[];
  constructor({ value, group, name, path, children }: GroupNodeParams) {
    this.name = name;
    this.value = value;
    this.isOpen = false;
    this.group = group;
    this.path = path;
    this.children = children;
    makeObservable(this, {
      isOpen: observable,
    });
  }

  toSerializable(): any {
    return {
      name: this.name,
      children: this.children.map(([child, color]) => [
        child.toSerializable(),
        color,
      ]),
      group: this.group,
      path: this.path,
      value: this.value,
      isOpen: this.isOpen,
    };
  }

  static fromSerializable(val: any): GroupNode {
    return new GroupNode({
      ...val,
      children: val.children.map(([child, color]: any) => [
        "group" in child
          ? GroupNode.fromSerializable(child)
          : AssetNode.fromSerializable(child),
        color,
      ]),
    });
  }
}

interface AssetNodeParams {
  name: string;
  value: number;
  path: string[];
  asset: Asset;
}

export class AssetNode {
  readonly name: string;
  readonly value: number;
  readonly asset: DeepReadonly<Asset>;
  readonly path: readonly string[];
  constructor({ asset, name, path, value }: AssetNodeParams) {
    this.asset = asset;
    this.name = name;
    this.path = path;
    this.value = value;
  }
  toSerializable(): any {
    return {
      name: this.name,
      value: this.value,
      asset: this.asset,
      path: this.path,
    };
  }
  static fromSerializable(val: any): AssetNode {
    return new AssetNode(val);
  }
}

class InvalidDataError extends Error {
  name: "InvalidDataError" = "InvalidDataError";
  constructor(msg: string) {
    super(msg);
  }
}

export async function validateAndFetchData(data: any): Promise<GroupNode> {
  if (!data || typeof data !== "object") {
    throw new InvalidDataError(`Unexpected type - data is: ${data}`);
  }
  if (!isAssetGroup(data)) {
    throw new InvalidDataError(`Expected AssetGroup ${data}`);
  }
  const countColors = (node: AssetGroup) => {
    let colorCount = 0;
    node.entries.forEach((entry) => {
      if (isIndividualAsset(entry)) {
        colorCount++;
      } else if (isAssetGroup(entry)) {
        colorCount += countColors(entry) + 1;
      }
    });
    return colorCount;
  };
  const palette = shuffleArray(
    distinctColors({
      chromaMax: 80,
      chromaMin: 20,
      count: countColors(data),
      lightMax: 50,
      lightMin: 5,
      samples: Math.floor(Math.random() * 1000) + 400,
    }).map((c) => c.hex() as Color)
  );

  let nextColor = 0;
  const getNextColor = () => {
    assert(
      nextColor < palette.length,
      () =>
        `Out of bounds! Index: ${nextColor}, pallete length: ${palette.length}`
    );
    const color = palette[nextColor];
    nextColor++;
    return color;
  };

  return validateAssetGroup(data, [], getNextColor);
}

async function validateAssetGroup(
  group: AssetGroup,
  path: string[],
  getNextColor: () => Color
): Promise<GroupNode> {
  const errorMsg = (msg: string) => `${msg} (path: ${path.join(".")})`;
  assert(isString(group.name), () =>
    errorMsg(`Expected group to have a name, but got: ${group.name}`)
  );
  assert(Array.isArray(group.entries), () =>
    errorMsg(`Expected group.entries to be an array, but got: ${group.entries}`)
  );
  const newPath = [...path, group.name];

  const children: NodeChild[] = [];
  let value = 0;
  for (const entry of group.entries) {
    if (!entry || typeof entry !== "object") {
      throw new InvalidDataError(
        errorMsg(`Unexpected type - entry is: ${entry}`)
      );
    }
    const child = await validateAssetEntry(entry, newPath, getNextColor);
    value += child.value;
    children.push([child, getNextColor()]);
  }
  return new GroupNode({
    name: group.name,
    group,
    path,
    children,
    value,
  });
}

async function validateAssetEntry(
  entry: AssetEntry,
  path: string[],
  getNextColor: () => Color
): Promise<Node> {
  if (isIndividualAsset(entry)) {
    return validateAsset(entry, path);
  } else {
    return validateAssetGroup(entry, path, getNextColor);
  }
}

async function validateAsset(asset: Asset, path: string[]): Promise<AssetNode> {
  const errorMsg = (msg: string) => `${msg} (path: ${path.join(".")})`;
  switch (asset.type) {
    case "cash-reserve": {
      assert(availableCurrenciesSet.has(asset.currency), () =>
        errorMsg(`Unexpected currency ${asset.currency}`)
      );
      assert(isFinite(asset.qty), () =>
        errorMsg(`Unexpected qty ${asset.qty}`)
      );
      // https://docs.awesomeapi.com.br/api-de-moedas
      const exchangeRate =
        asset.currency === "BRL"
          ? 1
          : +(
              await (
                await fetch(
                  `https://economia.awesomeapi.com.br/json/last/${asset.currency}`
                )
              ).json()
            )[`${asset.currency}BRL`].ask;
      assert(
        isFinite(exchangeRate),
        () => `Failed to fetch exchange rate for ${asset.currency}`
      );
      return new AssetNode({
        asset,
        path,
        name: `${currencyNames[asset.currency]} (${asset.currency})`,
        value: asset.qty * exchangeRate,
      });
    }
    case "crypto-currency": {
      const { availableCryptoCurrenciesSet, cryptoCurrencyNames } =
        await fetchCryptoCurrencies();
      assert(isFinite(asset.qty), () =>
        errorMsg(`Unexpected qty ${asset.qty}`)
      );
      assert(availableCryptoCurrenciesSet.has(asset.ticker), () =>
        errorMsg(`Unexpected crypto currency ${asset.ticker}`)
      );
      const CoinGeckoClient = new CoinGecko();
      const id = cryptoCurrencyNames[asset.ticker].id;
      const cryptoPrice = (
        await CoinGeckoClient.simple.price({
          ids: id,
          vs_currencies: "brl",
        })
      ).data?.[id]?.brl;
      assert(
        isFinite(cryptoPrice),
        () => `Failed to fetch crypto price rate for ${asset.ticker}`
      );
      // coingecko-api
      return new AssetNode({
        asset,
        path,
        name:
          cryptoCurrencyNames[asset.ticker].name === asset.ticker ||
          cryptoCurrencyNames[asset.ticker].name === asset.ticker.toUpperCase()
            ? cryptoCurrencyNames[asset.ticker].name
            : `${
                cryptoCurrencyNames[asset.ticker].name
              } (${asset.ticker.toUpperCase()})`,
        value: cryptoPrice * asset.qty,
      });
    }
    case "private-credit-br": {
      assert(isString(asset.name), () =>
        errorMsg(
          `Expected private credit bond to have a name, but got: ${asset.name}`
        )
      );
      assert(isFinite(asset.investedAmount), () =>
        errorMsg(
          `Expected invested amount to be a number, but got: ${asset.investedAmount}`
        )
      );
      const startDate = new Date(asset.start);
      assert(
        isString(asset.start) && startDate.toString() !== "Invalid Date",
        () => errorMsg(`Unexpected start date: ${asset.start}`)
      );
      const endDate = new Date(asset.end);
      assert(isString(asset.end) && endDate.toString() !== "Invalid Date", () =>
        errorMsg(`Unexpected end date: ${asset.end}`)
      );
      let currentValue = asset.investedAmount;
      const now = new Date();
      const days =
        (Math.min(now.getTime(), endDate.getTime()) - startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      if (asset.cdi != null) {
        assert(isFinite(asset.cdi), () =>
          errorMsg(`Expected CDI rate to be a number, but got: ${asset.cdi}`)
        );
        assert(!asset.ipca, () =>
          errorMsg(
            `Private credit bond should either have IPCA or CDI set, but got: ${pick(
              asset,
              "ipca",
              "cdi"
            )}`
          )
        );
        assert(asset.prefixedRate == null || isFinite(asset.prefixedRate), () =>
          errorMsg(
            `Expected prefixedRate to be a number, but got: ${asset.prefixedRate}`
          )
        );
        const { cdi } = await fetchInterestData();
        let cdiAccumulated = 1;
        cdi.forEach((rate) => {
          const date = new Date(rate.date);
          assert(
            date.toString() !== "Invalid Date" && isFinite(rate.value),
            () => "Failed to fetch interest data"
          );
          if (startDate < date && date <= endDate) {
            cdiAccumulated = cdiAccumulated * (1 + rate.value / 100);
          }
        });
        currentValue =
          currentValue *
          (cdiAccumulated * Math.pow(asset.cdi / 100, days / 365));
      } else {
        assert(isFinite(asset.prefixedRate), () =>
          errorMsg(
            `Expected prefixedRate to be a number, but got: ${asset.prefixedRate}`
          )
        );
        if (asset.ipca) {
          const { ipca } = await fetchInflationData();
          ipca.forEach((rate) => {
            const date = new Date(rate.date);
            assert(
              date.toString() !== "Invalid Date" && isFinite(rate.value),
              () => "Failed to fetch inflation data"
            );
            if (startDate < date && date <= endDate) {
              currentValue = currentValue * (1 + rate.value / 100);
            }
          });
        }
      }

      if (asset.prefixedRate != null) {
        currentValue =
          currentValue * Math.pow(1 + asset.prefixedRate / 100, days / 365);
      }

      // IPCA Mensal: https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json
      // CDI Diario: https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json
      return new AssetNode({
        asset,
        path,
        name: asset.name,
        value: currentValue,
      });
    }
    case "shares-br": {
      assert(isFinite(asset.qty), () =>
        errorMsg(`Unexpected qty ${asset.qty}`)
      );
      assert(isString(asset.ticker), () =>
        errorMsg(`Unexpected ticker ${asset.ticker}`)
      );
      // yahoo-finance2
      // Format: `${TICKER}.SA`
      const quote = await yahooFinance.quote(`${asset.ticker}.SA`);
      const { regularMarketPrice: price, currency, longName } = quote;
      assert(
        isFinite(price),
        () => `Failed to fetch price from yahoo-finance for ${asset.ticker}`
      );
      assert(
        currency === "BRL",
        () => `Unexpected currency ${currency} for Brazilian share`
      );
      return new AssetNode({
        asset,
        path,
        name: longName ? `${asset.ticker} - ${longName}` : asset.ticker,
        value: (price as number) * asset.qty,
      });
    }
    case "shares-us": {
      assert(isFinite(asset.qty), () =>
        errorMsg(`Unexpected qty ${asset.qty}`)
      );
      assert(isString(asset.ticker), () =>
        errorMsg(`Unexpected ticker ${asset.ticker}`)
      );
      // yahoo-finance2
      const quote = await yahooFinance.quote(asset.ticker);
      const { regularMarketPrice: price, currency, longName } = quote;
      assert(
        isFinite(price),
        () => `Failed to fetch price from yahoo-finance for ${asset.ticker}`
      );
      assert(
        currency === "USD",
        () => `Unexpected currency ${currency} for US share`
      );
      const usdPrice = await fetchUsdPrice();
      assert(
        isFinite(usdPrice),
        () => `Failed to fetch USD price, got: ${usdPrice}`
      );
      return new AssetNode({
        asset,
        path,
        name: longName ? `${asset.ticker} - ${longName}` : asset.ticker,
        value: (price as number) * usdPrice * asset.qty,
      });
    }
    case "treasury-br": {
      assert(isFinite(asset.qty), () =>
        errorMsg(`Unexpected qty ${asset.qty}`)
      );
      assert(isString(asset.name), () =>
        errorMsg(`Unexpected bond name ${asset.name}`)
      );
      const bonds = await fetchTreasuryData();
      const bond = bonds.find((b) => b.name === asset.name);
      assert(bond != null, () =>
        errorMsg(`Couldn't find treasury bond with name ${asset.name}`)
      );
      assert(isFinite(bond.value), () => `Failed to get data for ${bond.name}`);
      // https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json
      return new AssetNode({
        asset,
        path,
        name: asset.name,
        value: asset.qty * bond.value,
      });
    }
    default:
      assertNever(asset, () =>
        errorMsg(`Unexpected asset type ${asset["type"]}`)
      );
  }
}
