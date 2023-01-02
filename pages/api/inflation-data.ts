// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import axios from "axios";
import https from "https";
import { isString } from "lodash";
import type { NextApiRequest, NextApiResponse } from "next";
import { assert } from "../../utils/common";

interface Rate {
  date: string;
  value: number;
}

export interface InflationData {
  ipca: Rate[];
}

// HACK - see notes in `pages/api/treasury-data.ts`
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InflationData>
) {
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
  res.status(200).json({
    ipca: ipcaRates.map((v) => ({
      date: parseDate(v.data),
      value: +v.valor,
    })),
  });
}
