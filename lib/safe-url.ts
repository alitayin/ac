const ALLOWED_EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:"])
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export const getSafeExternalUrl = (value?: string | null): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    return ALLOWED_EXTERNAL_URL_PROTOCOLS.has(parsed.protocol) && parsed.host
      ? trimmed
      : null
  } catch (_error) {
    return null
  }
}

export const normalizeSafeExternalUrl = (value?: string | null): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) {
    return null
  }

  const explicitUrl = getSafeExternalUrl(trimmed)
  if (explicitUrl || URL_SCHEME_PATTERN.test(trimmed) || trimmed.startsWith("//")) {
    return explicitUrl
  }

  return getSafeExternalUrl(`https://${trimmed}`)
}
