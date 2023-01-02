// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import axios from "axios";
import https from "https";
import type { NextApiRequest, NextApiResponse } from "next";
import type { TreasuryBrBond } from "../../utils/data-model";

// HACK: required to fetch from
// https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json
// Apparently, the certificates aren't properly set for it to be fetched fro
// the server (and we can't fetch it from the client due to CORS).
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ data: TreasuryBrBond[] }>
) {
  const { response } = (
    await axios.get(
      "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json"
    )
  ).data;
  res.status(200).json({
    data: (response.TrsrBdTradgList as any[]).map((bond) => ({
      name: bond.TrsrBd.nm,
      value: bond.TrsrBd.untrInvstmtVal || bond.TrsrBd.untrRedVal,
    })),
  });
}
