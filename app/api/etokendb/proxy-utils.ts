import { NextResponse } from "next/server"

export const ETOKENDB_PROXY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
}

export const getEtokenDbErrorMessage = (
  payload: unknown,
  fallback: string,
): string => {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error
    if (typeof error === "string") {
      return error
    }
    if (error && typeof error === "object") {
      const code =
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : null
      const message =
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : null
      if (code && message) {
        return `${code}: ${message}`
      }
      if (message) {
        return message
      }
    }
  }

  return fallback
}

export const proxyEtokenDbError = (
  payload: unknown,
  upstreamStatus: number,
  fallback: string,
) =>
  NextResponse.json(
    {
      ok: false,
      error: getEtokenDbErrorMessage(payload, fallback),
    },
    {
      status: upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
      headers: ETOKENDB_PROXY_HEADERS,
    },
  )
