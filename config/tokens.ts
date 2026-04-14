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
};
