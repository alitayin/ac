// config/tokens.ts

interface TokenConfig {
  name: string
  symbol: string
  tokenId: string
  telegramUrl: string
  feature: string
  description: {
    title: string
    content: string
  }
  decimals?: number
  official?: boolean
  gratitude?: boolean
  community?: boolean
  stablecoin?: boolean
  apyTag?: string
  youtubeUrl?: string
  youtubeHoverImage?: string
}

export const tokens: Record<string, TokenConfig> = {
  starcrystal: {
    name: "StarCrystal",
    symbol: "SC", 
    tokenId: "ac31bb0bccf33de1683efce4da64f1cb6d8e8d6e098bc01c51d5864deb0e783f",
    telegramUrl: "https://t.me/agoraui",
    feature: "Star Crystal",
    description: {
      title: "StarCrystal Token Information",
      content: `StarCrystal, with a total supply of 5,120,000 tokens, is the official eToken of agora.cash, serving as fuel for activities on Agora.cash and participating in revenue sharing and governance.

      Benefits of Holding Star Crystal:
      • Listing Rights: Star Crystal is required to list your eTokens

      Current Status:
      • Total Supply: 5,120,000 tokens (Fixed supply)`
    }
  },
  SabongCash: {
    name: "SabongCash",
    symbol: "SAB",
    tokenId: "6d4e8cb81f7415c25ae2a425e9c6e2fd2648755fe9169ca208c1e349eadd9db5", 
    telegramUrl: "https://t.me/+1kSyU-gw4OFlMTM5",
    feature: "Utility Token for remote Sabong",
    description: {
      title: "",
      content: ""
    }
  },
  grp: {
    name: "GRP",
    symbol: "GRP", 
    tokenId: "fb4233e8a568993976ed38a81c2671587c5ad09552dedefa78760deed6ff87aa",
    telegramUrl: "https://t.me/Grumpy_eToken", 
    feature: "Community eToken",
    description: {
      title: "",
      content: ""
    }
  },
  xecx: {
    name: "XECX",
    symbol: "XECX",
    tokenId: "c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4",
    telegramUrl: "https://t.me/stakedxec",
    feature: "stakedxec",
    description: {
      title: "",
      content: ""
    }
  },
  starshard: {
    name: "Star Shard",
    symbol: "SS",
    tokenId: "d1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb",
    telegramUrl: "https://t.me/agoraui",
    feature: "Swap and more features",
    official: true,
    description: {
      title: "About Star Shard",
      content: "Like Star Crystal, it is filled with profound magical power, and it seems to be designed for swap and maybe also cross‑chain functionality. It exists in greater quantities. Holding it yields a 10% interest return.."
    }
  },
  firma: {
    name: "Firma",
    symbol: "FIRMA",
    tokenId: "0387947fd575db4fb19a3e322f635dec37fd192b5941625b66bc4b2c3008cbf0",
    telegramUrl: "https://t.me/firmadotcash",
    feature: "Yield-bearing Stablecoin",
    stablecoin: true,
    description: {
      title: "",
      content: ""
    }
  },
  meaning: {
    name: "TheMeaningofLife",
    symbol: "MEANING",
    tokenId: "f2d425cc81b52b137bd944ca1c2bd165d5fb57111bc1723cae71c3e8be51534a",
    telegramUrl: "http://www.youtube.com/@LifetheBook",
    feature: "Airdrops for Supporters",
    decimals: 2,
    description: {
      title: "",
      content: ""
    }
  },
  xecited: {
    name: "ImsoXECited",
    symbol: "XECITED",
    tokenId: "5af4edc6cf6f9d8924ea05407eb5676ca4378493611464120f964ece7ddf7ff1",
    telegramUrl: "http://www.youtube.com/@ImsoXECited",
    feature: "Airdrops for Supporters",
    decimals: 2,
    youtubeUrl: "https://www.youtube.com/@ImsoXECited",
    youtubeHoverImage: "/imsoexcited.png",
    description: {
      title: "",
      content: ""
    }
  },
  hwt: {
    name: "TridentbyHodlWars",
    symbol: "HWT",
    tokenId: "8814140e9d5dc359fe437d881c2c324b4e37c71bfd23226309940d742651e14b",
    telegramUrl: "https://t.me/hodl_wars",
    feature: "Hodl Wars Reward Token",
    description: {
      title: "",
      content: ""
    }
  },
  bve: {
    name: "Blockchain Ventures Equity",
    symbol: "BVE",
    tokenId: "96704added2310ba79cddecc7e192c56a8aa29542b7187539fc0327acddc8ac6",
    telegramUrl: "https://blockchain.ventures/",
    feature: "Blockchain Ventures Equity token",
    description: {
      title: "About Blockchain Ventures Equity (BVE)",
      content: `BVE is the Blockchain Ventures Equity token, offering equity-style exposure to Blockchain Ventures Corp. and its portfolio (e.g., eCash initiatives and the upcoming Blockchain Poker relaunch). See details at blockchain.ventures.`
    }
  },
};