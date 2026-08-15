import { describe, expect, it, vi } from "vitest";
import { encodeOutputScript } from "ecashaddrjs";

import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions";

const buyerScript = "76a914111111111111111111111111111111111111111188ac";
const otherBuyerScript = "76a914222222222222222222222222222222222222222288ac";
const sellerScript = "76a914333333333333333333333333333333333333333388ac";
const otherSellerScript = "76a914444444444444444444444444444444444444444488ac";
const buyerAddress = encodeOutputScript(buyerScript, "ecash");
const sellerAddress = encodeOutputScript(sellerScript, "ecash");

vi.mock("@/config/tokens", () => ({ tokens: {} }));

vi.mock("@/lib/chronik", () => ({
  chronik: {},
  fetchTokenDetails: vi.fn().mockResolvedValue({ genesisInfo: { decimals: 2 } }),
  getTokenDecimalsFromDetails: vi.fn(() => 2),
  getTokenAmountFromToken: vi.fn((token: any) => token.amount || token.atoms || BigInt(0)),
  getAddressFromOutputScript: (script?: string) => {
    if (!script) return null;
    return encodeOutputScript(script, "ecash");
  },
}));

const makeTrade = (
  txid: string,
  tokenOutputScript: string,
  xecOutputScript = sellerScript,
) => ({
  txid,
  inputs: [{ inputScript: "514d075041525449414c" }],
  outputs: [
    {},
    { sats: 100000, outputScript: xecOutputScript },
    {},
    {
      outputScript: tokenOutputScript,
      token: {
        tokenId: "firma-token",
        amount: BigInt(1000000),
      },
    },
  ],
  block: { height: 800000, timestamp: 1700000000 },
});

describe("Firma trade history filtering", () => {
  it("keeps only Agora trades where the wallet received Firma", async () => {
    const mockChronik = {
      tokenId: vi.fn().mockReturnThis(),
      history: vi.fn().mockResolvedValue({
        txs: [
          makeTrade("owned-firma-trade", buyerScript),
          makeTrade("other-firma-trade", otherBuyerScript),
        ],
        numPages: 1,
      }),
    };

    const result = await fetchAgoraTransactionsFromChronik(
      "firma-token",
      undefined,
      { address: buyerAddress, pageSize: 50 },
      mockChronik as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.txid).toBe("owned-firma-trade");
    expect(result[0]?.buyerAddress).toBe(buyerAddress);
    expect(result[0]?.sellerAddress).toBe(sellerAddress);
  });

  it("filters by either side of the trade and preserves buy/sell addresses", async () => {
    const walletBuy = makeTrade("wallet-buy", buyerScript, sellerScript);
    const walletSell = makeTrade("wallet-sell", otherBuyerScript, buyerScript);
    const unrelated = makeTrade("unrelated", otherBuyerScript, otherSellerScript);
    const mockChronik = {
      tokenId: vi.fn().mockReturnThis(),
      history: vi.fn().mockResolvedValue({
        txs: [walletBuy, walletSell, unrelated],
        numPages: 1,
      }),
    };

    const result = await fetchAgoraTransactionsFromChronik(
      "firma-token",
      undefined,
      { address: buyerAddress, addressRole: "either", pageSize: 50 },
      mockChronik as any,
    );

    expect(result.map((transaction) => transaction.txid)).toEqual([
      "wallet-buy",
      "wallet-sell",
    ]);
    expect(result[0]).toMatchObject({
      buyerAddress,
      sellerAddress,
    });
    expect(result[1]).toMatchObject({
      buyerAddress: encodeOutputScript(otherBuyerScript, "ecash"),
      sellerAddress: buyerAddress,
    });
  });

  it("supports explicit buyer and seller address roles", async () => {
    const walletBuy = makeTrade("wallet-buy", buyerScript, sellerScript);
    const walletSell = makeTrade("wallet-sell", otherBuyerScript, buyerScript);
    const mockChronik = {
      tokenId: vi.fn().mockReturnThis(),
      history: vi.fn().mockResolvedValue({
        txs: [walletBuy, walletSell],
        numPages: 1,
      }),
    };

    const buyerTrades = await fetchAgoraTransactionsFromChronik(
      "firma-token",
      undefined,
      { address: buyerAddress, addressRole: "buyer", pageSize: 50 },
      mockChronik as any,
    );
    const sellerTrades = await fetchAgoraTransactionsFromChronik(
      "firma-token",
      undefined,
      { address: buyerAddress, addressRole: "seller", pageSize: 50 },
      mockChronik as any,
    );

    expect(buyerTrades.map((transaction) => transaction.txid)).toEqual([
      "wallet-buy",
    ]);
    expect(sellerTrades.map((transaction) => transaction.txid)).toEqual([
      "wallet-sell",
    ]);
  });
});
