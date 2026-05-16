const BLOCKED_TOKEN_IDS = new Set([
  "7d7662421c0e1bed88aca30773872c8ec685c27384799deb9a34bb783aab67c8",
])

export const isBlockedTokenId = (tokenId: string | null | undefined): boolean => {
  return typeof tokenId === "string" && BLOCKED_TOKEN_IDS.has(tokenId.trim().toLowerCase())
}

export const filterBlockedTokenIds = <T extends { tokenId: string }>(tokens: T[]): T[] => {
  return tokens.filter((token) => !isBlockedTokenId(token.tokenId))
}
