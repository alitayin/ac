"use client"

import * as React from "react"
import Link from "next/link"
import quick from "ecash-quicksend"
import {
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquareText,
  Send,
  Wallet,
} from "lucide-react"
import { encodeCashAddress } from "ecashaddrjs"
import { shaRmd160 } from "ecash-lib"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/lib/context/WalletContext"
import {
  createEtokenDbProjectInfoInvoice,
  fetchEtokenDbProjectInfoInvoice,
  fetchEtokenDbTokenProjectInfo,
  submitEtokenDbProjectInfoInvoiceTx,
  type EtokenDbProjectInfoInvoice,
  type EtokenDbTokenProjectInfo,
} from "@/lib/etokendb"
import { normalizeSafeExternalUrl } from "@/lib/safe-url"
import { cn } from "@/lib/utils"

type TokenProjectInfoCardProps = {
  tokenId: string
  tokenName: string
  authPubkey?: string | null
  tokenTicker?: string | null
  createdBlockHeight?: number | null
  createdTimestamp?: number | null
  fallbackWebsiteUrl?: string | null
  fallbackTelegramUrl?: string | null
  buyHref?: string | null
  className?: string
  contentClassName?: string
}

type ProjectInfoFormState = {
  description: string
  websiteUrl: string
  xUrl: string
  telegramUrl: string
}

type PendingProjectInfoSession = ProjectInfoFormState & {
  tokenId: string
  invoiceId: string
  txid: string | null
  updatedAt: number
}

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 60_000
const DESCRIPTION_MAX_BYTES = 1000
const URL_MAX_CHARS = 500
const PENDING_PROJECT_INFO_STORAGE_KEY = "token_project_info_pending_v1"
const TEST_PROJECT_INFO_TOKEN_ID =
  "5cb20c6cdeaee3abf53f7dcaaa1092ad10a0e2e9dcd94ee07272b631e65d7371"
const TEST_PROJECT_INFO_FEE_LABEL = "100 XEC"

const textEncoder = new TextEncoder()

const emptyFormState: ProjectInfoFormState = {
  description: "",
  websiteUrl: "",
  xUrl: "",
  telegramUrl: "",
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getByteLength = (value: string): number => textEncoder.encode(value).length

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.trim().toLowerCase()
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16)
  }
  return bytes
}

const formatAddress = (value: string): string => {
  if (value.length <= 18) {
    return value
  }
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

const formatTokenId = (value: string): string => {
  if (value.length <= 18) {
    return value
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

const formatCreatedAt = (timestamp?: number | null): string | null => {
  if (!timestamp) {
    return null
  }

  try {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch (_error) {
    return null
  }
}

const normalizeExternalUrl = (value?: string | null): string | null => {
  return normalizeSafeExternalUrl(value)
}

const getGenesisAuthorityAddress = (authPubkey?: string | null): string | null => {
  try {
    const normalized = normalizeHex(authPubkey)
    if (normalized.length !== 66) {
      return null
    }

    const pubkeyHash = shaRmd160(hexToBytes(normalized))
    return encodeCashAddress("ecash", "p2pkh", pubkeyHash)
  } catch (_error) {
    return null
  }
}

const formatUpdatedAt = (timestamp: number | null): string => {
  if (!timestamp) {
    return "Not published"
  }

  try {
    return new Date(timestamp).toLocaleString()
  } catch (_error) {
    return "Published"
  }
}

const getFeeLabel = (
  invoice: EtokenDbProjectInfoInvoice | null,
  hasInfo: boolean,
  tokenId: string,
): string => {
  if (invoice?.expectedPaidXec) {
    return `${invoice.expectedPaidXec} XEC`
  }
  if (tokenId.toLowerCase() === TEST_PROJECT_INFO_TOKEN_ID) {
    return TEST_PROJECT_INFO_FEE_LABEL
  }
  return hasInfo ? "100,000 XEC" : "1,000,000 XEC"
}

const normalizeFormState = (state: ProjectInfoFormState): ProjectInfoFormState => ({
  description: state.description.trim(),
  websiteUrl: state.websiteUrl.trim(),
  xUrl: state.xUrl.trim(),
  telegramUrl: state.telegramUrl.trim(),
})

const normalizeUrlFormState = (state: ProjectInfoFormState): ProjectInfoFormState => {
  const normalized = normalizeFormState(state)
  return {
    ...normalized,
    websiteUrl: normalizeExternalUrl(normalized.websiteUrl) ?? "",
    xUrl: normalizeExternalUrl(normalized.xUrl) ?? "",
    telegramUrl: normalizeExternalUrl(normalized.telegramUrl) ?? "",
  }
}

const normalizeHex = (value?: string | null): string =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

const hasAnyFormField = (state: ProjectInfoFormState): boolean => {
  const normalized = normalizeFormState(state)
  return Boolean(
    normalized.description ||
      normalized.websiteUrl ||
      normalized.xUrl ||
      normalized.telegramUrl,
  )
}

const toNullableUrl = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const projectInfoToFormState = (
  info: EtokenDbTokenProjectInfo | null,
  fallbacks?: { websiteUrl?: string | null; telegramUrl?: string | null },
): ProjectInfoFormState => ({
  description: info?.description ?? "",
  websiteUrl: info?.websiteUrl ?? fallbacks?.websiteUrl ?? "",
  xUrl: info?.xUrl ?? "",
  telegramUrl: info?.telegramUrl ?? fallbacks?.telegramUrl ?? "",
})

const readPendingProjectInfoSessions = (): Record<string, PendingProjectInfoSession> => {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(PENDING_PROJECT_INFO_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, PendingProjectInfoSession> | null
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (_error) {
    return {}
  }
}

const getPendingProjectInfoSession = (
  tokenId: string,
): PendingProjectInfoSession | null => {
  const sessions = readPendingProjectInfoSessions()
  const session = sessions[tokenId]
  return session && typeof session === "object" ? session : null
}

const setPendingProjectInfoSession = (session: PendingProjectInfoSession) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = readPendingProjectInfoSessions()
    sessions[session.tokenId] = session
    window.localStorage.setItem(
      PENDING_PROJECT_INFO_STORAGE_KEY,
      JSON.stringify(sessions),
    )
  } catch (_error) {}
}

const clearPendingProjectInfoSession = (tokenId: string) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    const sessions = readPendingProjectInfoSessions()
    if (!(tokenId in sessions)) {
      return
    }
    delete sessions[tokenId]
    window.localStorage.setItem(
      PENDING_PROJECT_INFO_STORAGE_KEY,
      JSON.stringify(sessions),
    )
  } catch (_error) {}
}

type InfoLink = {
  label: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type BasicAction = {
  label: string
  value: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title?: string
  href?: string
  onClick?: () => void
}

export function TokenProjectInfoCard({
  tokenId,
  tokenName,
  authPubkey,
  tokenTicker,
  createdBlockHeight,
  createdTimestamp,
  fallbackWebsiteUrl,
  fallbackTelegramUrl,
  buyHref,
  className,
  contentClassName,
}: TokenProjectInfoCardProps) {
  const { toast } = useToast()
  const {
    isWalletConnected,
    ecashAddress,
    mnemonic,
    isGuestMode,
    publicKeyHex,
    refreshBalance,
  } = useWallet()

  const [info, setInfo] = React.useState<EtokenDbTokenProjectInfo | null>(null)
  const [isLoadingInfo, setIsLoadingInfo] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [formState, setFormState] = React.useState<ProjectInfoFormState>(emptyFormState)
  const [invoice, setInvoice] = React.useState<EtokenDbProjectInfoInvoice | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const mountedRef = React.useRef(true)
  const resumeAttemptedInvoiceRef = React.useRef<string | null>(null)

  const normalizedAuthPubkey = normalizeHex(authPubkey)
  const normalizedWalletPubkey = normalizeHex(publicKeyHex)
  const isGenesisAuthPubkeyWallet = Boolean(
    normalizedAuthPubkey &&
      normalizedWalletPubkey &&
      normalizedWalletPubkey === normalizedAuthPubkey,
  )
  const hasSigningWallet = Boolean(isWalletConnected && ecashAddress && mnemonic && !isGuestMode)
  const canEdit = Boolean(isGenesisAuthPubkeyWallet && hasSigningWallet)
  const descriptionByteLength = React.useMemo(
    () => getByteLength(formState.description),
    [formState.description],
  )
  const isDescriptionTooLong = descriptionByteLength > DESCRIPTION_MAX_BYTES
  const isAnyUrlTooLong =
    formState.websiteUrl.length > URL_MAX_CHARS ||
    formState.xUrl.length > URL_MAX_CHARS ||
    formState.telegramUrl.length > URL_MAX_CHARS
  const hasProjectInfoRecord = Boolean(info)
  const hasPublishedInfo = Boolean(
    info &&
      (info.description || info.websiteUrl || info.xUrl || info.telegramUrl),
  )
  const normalizedFormState = React.useMemo(
    () => normalizeFormState(formState),
    [formState],
  )
  const isInvoiceStale =
    Boolean(invoice) &&
    (invoice?.description !== normalizedFormState.description ||
      (invoice?.websiteUrl ?? "") !== normalizedFormState.websiteUrl ||
      (invoice?.xUrl ?? "") !== normalizedFormState.xUrl ||
      (invoice?.telegramUrl ?? "") !== normalizedFormState.telegramUrl)
  const isPublishedInvoice =
    Boolean(invoice) && !isInvoiceStale && invoice?.status === "published"
  const canSubmit = Boolean(
    canEdit &&
      !isSubmitting &&
      !isPublishedInvoice &&
      !isDescriptionTooLong &&
      !isAnyUrlTooLong &&
      (hasProjectInfoRecord || hasAnyFormField(formState)),
  )
  const submitFeeLabel = getFeeLabel(invoice, hasProjectInfoRecord, tokenId)
  const creatorAddress = React.useMemo(
    () => getGenesisAuthorityAddress(authPubkey),
    [authPubkey],
  )
  const createdAtLabel = React.useMemo(
    () => formatCreatedAt(createdTimestamp),
    [createdTimestamp],
  )
  const fallbackWebsiteHref = React.useMemo(
    () => normalizeExternalUrl(fallbackWebsiteUrl),
    [fallbackWebsiteUrl],
  )
  const fallbackTelegramHref = React.useMemo(
    () => normalizeExternalUrl(fallbackTelegramUrl),
    [fallbackTelegramUrl],
  )

  const infoLinks = React.useMemo<InfoLink[]>(() => {
    const links: InfoLink[] = []
    const websiteHref = normalizeExternalUrl(info?.websiteUrl)
    const xHref = normalizeExternalUrl(info?.xUrl)
    const telegramHref = normalizeExternalUrl(info?.telegramUrl)

    if (websiteHref) {
      links.push({ label: "Website", href: websiteHref, icon: Globe })
    }
    if (xHref) {
      links.push({ label: "X", href: xHref, icon: ExternalLink })
    }
    if (telegramHref) {
      links.push({ label: "Telegram", href: telegramHref, icon: Send })
    }
    return links
  }, [info])

  const copyTokenId = React.useCallback(() => {
    void navigator.clipboard?.writeText(tokenId)
  }, [tokenId])

  const copyCreatorAddress = React.useCallback(() => {
    if (!creatorAddress) {
      return
    }
    void navigator.clipboard?.writeText(creatorAddress)
  }, [creatorAddress])

  const basicActions = React.useMemo<BasicAction[]>(() => {
    const actions: BasicAction[] = [
      {
        label: "Token ID",
        value: formatTokenId(tokenId),
        title: tokenId,
        icon: Copy,
        onClick: copyTokenId,
      },
      {
        label: "Explorer",
        value: "Open",
        icon: ExternalLink,
        href: `https://explorer.e.cash/tx/${tokenId}`,
      },
    ]

    if (fallbackWebsiteHref) {
      actions.push({
        label: "Website",
        value: "Open",
        title: fallbackWebsiteHref,
        icon: Globe,
        href: fallbackWebsiteHref,
      })
    }

    if (fallbackTelegramHref) {
      actions.push({
        label: "Telegram",
        value: "Open",
        title: fallbackTelegramHref,
        icon: Send,
        href: fallbackTelegramHref,
      })
    }

    return actions
  }, [
    copyTokenId,
    fallbackTelegramHref,
    fallbackWebsiteHref,
    tokenId,
  ])

  const hasBasicMeta = Boolean(
    tokenName ||
      tokenTicker ||
      creatorAddress ||
      createdAtLabel ||
      typeof createdBlockHeight === "number",
  )

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshProjectInfo = React.useCallback(async () => {
    if (!tokenId) {
      return null
    }

    const nextInfo = await fetchEtokenDbTokenProjectInfo(tokenId)
    if (mountedRef.current) {
      setInfo(nextInfo)
    }
    return nextInfo
  }, [tokenId])

  React.useEffect(() => {
    if (!tokenId) {
      setInfo(null)
      return
    }

    let cancelled = false
    setIsLoadingInfo(true)

    void fetchEtokenDbTokenProjectInfo(tokenId)
      .then((nextInfo) => {
        if (!cancelled && mountedRef.current) {
          setInfo(nextInfo)
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setInfo(null)
        }
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setIsLoadingInfo(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [tokenId])

  React.useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    setErrorMessage("")
    setStatusMessage("")
    setInvoice(null)
    resumeAttemptedInvoiceRef.current = null

    const pendingSession = getPendingProjectInfoSession(tokenId)
    setFormState(
      pendingSession ??
        projectInfoToFormState(info, {
          websiteUrl: fallbackWebsiteUrl,
          telegramUrl: fallbackTelegramUrl,
        }),
    )
  }, [fallbackTelegramUrl, fallbackWebsiteUrl, info, isDialogOpen, tokenId])

  const clearSessionForCurrentToken = React.useCallback(() => {
    clearPendingProjectInfoSession(tokenId)
  }, [tokenId])

  const persistSessionForCurrentToken = React.useCallback(
    (next: ProjectInfoFormState & { invoiceId: string; txid: string | null }) => {
      setPendingProjectInfoSession({
        tokenId,
        invoiceId: next.invoiceId,
        description: next.description,
        websiteUrl: next.websiteUrl,
        xUrl: next.xUrl,
        telegramUrl: next.telegramUrl,
        txid: next.txid,
        updatedAt: Date.now(),
      })
    },
    [tokenId],
  )

  const pollInvoiceUntilSettled = React.useCallback(
    async (invoiceId: string): Promise<EtokenDbProjectInfoInvoice> => {
      const startedAt = Date.now()
      let latestInvoice = await fetchEtokenDbProjectInfoInvoice(invoiceId)

      while (
        latestInvoice.status === "pending" ||
        latestInvoice.status === "tx_submitted"
      ) {
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          return latestInvoice
        }

        await sleep(POLL_INTERVAL_MS)
        latestInvoice = await fetchEtokenDbProjectInfoInvoice(invoiceId)
        if (mountedRef.current) {
          setInvoice(latestInvoice)
        }
      }

      return latestInvoice
    },
    [],
  )

  const payInvoice = React.useCallback(
    async (activeInvoice: EtokenDbProjectInfoInvoice): Promise<string> => {
      if (!mnemonic) {
        throw new Error("A mnemonic-backed wallet login is required for payment")
      }

      const result = await quick.sendXec(
        [
          {
            address: activeInvoice.paymentAddress,
            amount: BigInt(activeInvoice.expectedPaidSats),
          },
        ],
        {
          mnemonic,
          utxoStrategy: "minimal",
        },
      )

      return result.txid
    },
    [mnemonic],
  )

  const settleResolvedInvoice = React.useCallback(
    async (resolvedInvoice: EtokenDbProjectInfoInvoice) => {
      if (mountedRef.current) {
        setInvoice(resolvedInvoice)
      }

      if (resolvedInvoice.status === "published") {
        clearSessionForCurrentToken()
        await refreshProjectInfo()
        await refreshBalance()
        if (mountedRef.current) {
          setStatusMessage("Published")
        }
        return resolvedInvoice
      }

      if (resolvedInvoice.status === "invalid" || resolvedInvoice.status === "expired") {
        clearSessionForCurrentToken()
      }

      return resolvedInvoice
    },
    [clearSessionForCurrentToken, refreshBalance, refreshProjectInfo],
  )

  const resumePendingProjectInfo = React.useCallback(
    async (session: PendingProjectInfoSession) => {
      if (resumeAttemptedInvoiceRef.current === session.invoiceId) {
        return
      }

      resumeAttemptedInvoiceRef.current = session.invoiceId
      setIsSubmitting(true)
      setErrorMessage("")

      try {
        const currentInvoice = await fetchEtokenDbProjectInfoInvoice(session.invoiceId)

        if (!mountedRef.current) {
          return
        }

        setInvoice(currentInvoice)
        setFormState({
          description: session.description,
          websiteUrl: session.websiteUrl,
          xUrl: session.xUrl,
          telegramUrl: session.telegramUrl,
        })

        if (currentInvoice.status === "published") {
          await settleResolvedInvoice(currentInvoice)
          return
        }

        if (currentInvoice.status === "invalid" || currentInvoice.status === "expired") {
          await settleResolvedInvoice(currentInvoice)
          return
        }

        if (session.txid && currentInvoice.status === "pending") {
          setStatusMessage("Resubmitting saved payment txid")
          const submittedInvoice = await submitEtokenDbProjectInfoInvoiceTx(
            currentInvoice.invoiceId,
            { txid: session.txid },
          )
          persistSessionForCurrentToken({
            invoiceId: submittedInvoice.invoiceId,
            description: submittedInvoice.description,
            websiteUrl: submittedInvoice.websiteUrl ?? "",
            xUrl: submittedInvoice.xUrl ?? "",
            telegramUrl: submittedInvoice.telegramUrl ?? "",
            txid: session.txid,
          })

          if (mountedRef.current) {
            setInvoice(submittedInvoice)
          }

          if (submittedInvoice.status === "published") {
            await settleResolvedInvoice(submittedInvoice)
            return
          }

          setStatusMessage("Waiting for backend verification")
          const settledInvoice = await pollInvoiceUntilSettled(submittedInvoice.invoiceId)
          await settleResolvedInvoice(settledInvoice)
          return
        }

        if (currentInvoice.status === "tx_submitted") {
          setStatusMessage("Waiting for backend verification")
          const settledInvoice = await pollInvoiceUntilSettled(currentInvoice.invoiceId)
          await settleResolvedInvoice(settledInvoice)
          return
        }

        setStatusMessage("Pending invoice restored")
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to restore pending project info."
        if (mountedRef.current) {
          setErrorMessage(message)
          setStatusMessage("")
        }
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [
      persistSessionForCurrentToken,
      pollInvoiceUntilSettled,
      settleResolvedInvoice,
    ],
  )

  React.useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    const pendingSession = getPendingProjectInfoSession(tokenId)
    if (!pendingSession) {
      return
    }

    void resumePendingProjectInfo(pendingSession)
  }, [isDialogOpen, resumePendingProjectInfo, tokenId])

  const handleOpenEditor = () => {
    setIsDialogOpen(true)
  }

  const handleSubmitProjectInfo = React.useCallback(async () => {
    if (!tokenId || !ecashAddress || !mnemonic || isGuestMode || !isGenesisAuthPubkeyWallet) {
      return
    }

    const normalized = normalizeUrlFormState(formState)
    if (!hasProjectInfoRecord && !hasAnyFormField(normalized)) {
      return
    }

    setFormState(normalized)

    setIsSubmitting(true)
    setErrorMessage("")
    setStatusMessage("Creating invoice")

    try {
      const activeInvoice = isInvoiceStale
        ? await createEtokenDbProjectInfoInvoice(tokenId, {
            editorAddress: ecashAddress,
            description: normalized.description,
            websiteUrl: toNullableUrl(normalized.websiteUrl),
            xUrl: toNullableUrl(normalized.xUrl),
            telegramUrl: toNullableUrl(normalized.telegramUrl),
          })
        : invoice && (invoice.status === "pending" || invoice.status === "tx_submitted")
          ? invoice
          : await createEtokenDbProjectInfoInvoice(tokenId, {
              editorAddress: ecashAddress,
              description: normalized.description,
              websiteUrl: toNullableUrl(normalized.websiteUrl),
              xUrl: toNullableUrl(normalized.xUrl),
              telegramUrl: toNullableUrl(normalized.telegramUrl),
            })

      if (mountedRef.current) {
        setInvoice(activeInvoice)
      }
      persistSessionForCurrentToken({
        invoiceId: activeInvoice.invoiceId,
        description: activeInvoice.description,
        websiteUrl: activeInvoice.websiteUrl ?? "",
        xUrl: activeInvoice.xUrl ?? "",
        telegramUrl: activeInvoice.telegramUrl ?? "",
        txid: activeInvoice.paymentTxid,
      })

      if (activeInvoice.status === "pending") {
        setStatusMessage(`Paying ${activeInvoice.expectedPaidXec} XEC`)
        const txid = await payInvoice(activeInvoice)
        persistSessionForCurrentToken({
          invoiceId: activeInvoice.invoiceId,
          description: activeInvoice.description,
          websiteUrl: activeInvoice.websiteUrl ?? "",
          xUrl: activeInvoice.xUrl ?? "",
          telegramUrl: activeInvoice.telegramUrl ?? "",
          txid,
        })
        if (mountedRef.current) {
          setStatusMessage("Submitting payment txid")
        }

        const submittedInvoice = await submitEtokenDbProjectInfoInvoiceTx(
          activeInvoice.invoiceId,
          { txid },
        )

        if (mountedRef.current) {
          setInvoice(submittedInvoice)
          setStatusMessage("Waiting for backend verification")
        }
        persistSessionForCurrentToken({
          invoiceId: submittedInvoice.invoiceId,
          description: submittedInvoice.description,
          websiteUrl: submittedInvoice.websiteUrl ?? "",
          xUrl: submittedInvoice.xUrl ?? "",
          telegramUrl: submittedInvoice.telegramUrl ?? "",
          txid,
        })
      } else if (mountedRef.current) {
        setStatusMessage("Waiting for backend verification")
      }

      const settledInvoice = await pollInvoiceUntilSettled(activeInvoice.invoiceId)
      await settleResolvedInvoice(settledInvoice)

      if (settledInvoice.status === "published") {
        toast({
          title: "Project info published",
          description: `${tokenName} project details are now live.`,
        })
        setIsDialogOpen(false)
        return
      }

      if (settledInvoice.status === "tx_submitted") {
        setStatusMessage("Payment seen. Publication is still pending in the backend queue.")
        toast({
          title: "Payment submitted",
          description: "The backend has your txid and will keep retrying verification.",
        })
        return
      }

      if (settledInvoice.status === "expired") {
        throw new Error("The project info invoice expired before publication. Please try again.")
      }

      if (settledInvoice.status === "invalid") {
        throw new Error("The payment or genesis authority ownership did not match the invoice requirements.")
      }

      throw new Error(`Unexpected invoice status: ${settledInvoice.status}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit project info."
      if (mountedRef.current) {
        setErrorMessage(message)
        setStatusMessage("")
      }

      toast({
        title: "Project info failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }, [
    ecashAddress,
    formState,
    hasProjectInfoRecord,
    invoice,
    isGenesisAuthPubkeyWallet,
    isGuestMode,
    isInvoiceStale,
    mnemonic,
    payInvoice,
    persistSessionForCurrentToken,
    pollInvoiceUntilSettled,
    settleResolvedInvoice,
    toast,
    tokenId,
    tokenName,
  ])

  return (
    <>
      <Card className={cn("rounded-3xl", className)}>
        <CardHeader className="gap-2 p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Project Info</CardTitle>
              <CardDescription className="mt-1">
                {hasPublishedInfo
                  ? `Updated ${formatUpdatedAt(info?.updatedAt ?? null)}`
                  : "No project details published yet"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {buyHref ? (
                <Button asChild size="sm" className="rounded-md">
                  <Link href={buyHref}>Buy</Link>
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleOpenEditor}
                >
                  <Edit3 data-icon="inline-start" />
                  {hasProjectInfoRecord ? "Edit" : "Initialize"}
                </Button>
              ) : isGenesisAuthPubkeyWallet && !hasSigningWallet ? (
                <Badge variant="outline" className="shrink-0 rounded-md">
                  Wallet locked
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("flex flex-col gap-4 p-4 pt-0", contentClassName)}>
          <div className="flex flex-col gap-3">
            {isLoadingInfo ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : hasPublishedInfo ? (
              <>
                {info?.description ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                    {info.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This project has not added a description.
                  </p>
                )}

                {infoLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {infoLinks.map((link) => {
                      const Icon = link.icon
                      return (
                        <Button
                          key={link.label}
                          asChild
                          variant="outline"
                          size="sm"
                          className="min-w-0"
                        >
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={link.href}
                          >
                            <Icon data-icon="inline-start" />
                            <span className="truncate">{link.label}</span>
                          </a>
                        </Button>
                      )
                    })}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {info?.lastEditorMasked ? <span>{info.lastEditorMasked}</span> : null}
                  {info?.lastEditorMasked ? <span>/</span> : null}
                  <span>{info?.updateCount || 0} update{info?.updateCount === 1 ? "" : "s"}</span>
                </div>
              </>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                The token creator has not added project information yet. (Project information is submitted and edited by the token holder.)
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Basics
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  {tokenTicker ? `${tokenName} (${tokenTicker})` : tokenName}
                </p>
              </div>
              {typeof createdBlockHeight === "number" ? (
                <Badge variant="outline" className="shrink-0 rounded-md">
                  #{createdBlockHeight}
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {basicActions.map((action) => {
                const Icon = action.icon
                const content = (
                  <>
                    <Icon data-icon="inline-start" />
                    <span className="flex min-w-0 flex-col items-start leading-tight">
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {action.label}
                      </span>
                      <span className="max-w-full truncate text-xs font-medium">
                        {action.value}
                      </span>
                    </span>
                  </>
                )

                return action.href ? (
                  <Button
                    key={action.label}
                    asChild
                    variant="secondary"
                    size="sm"
                    className="h-auto min-h-10 justify-start gap-2 rounded-xl px-3 py-2"
                  >
                    <a
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={action.title ?? action.href}
                    >
                      {content}
                    </a>
                  </Button>
                ) : (
                  <Button
                    key={action.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-auto min-h-10 justify-start gap-2 rounded-xl px-3 py-2"
                    onClick={action.onClick}
                    title={action.title}
                  >
                    {content}
                  </Button>
                )
              })}
            </div>

            {hasBasicMeta ? (
              <div className="mt-3 grid gap-2 text-xs">
                {creatorAddress ? (
                  <button
                    type="button"
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-1 py-1 text-left hover:bg-background/70"
                    onClick={copyCreatorAddress}
                    title={creatorAddress}
                  >
                    <span className="shrink-0 text-muted-foreground">Creator</span>
                    <span className="truncate font-mono text-foreground/90">
                      {formatAddress(creatorAddress)}
                    </span>
                  </button>
                ) : null}

                {createdAtLabel ? (
                  <div className="flex min-w-0 items-center justify-between gap-3 px-1 py-1">
                    <span className="shrink-0 text-muted-foreground">Created</span>
                    <span className="truncate text-foreground/90">
                      {createdAtLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {!canEdit && isGenesisAuthPubkeyWallet && !hasSigningWallet ? (
            <Alert className="border-primary/20 bg-primary/5">
              <Wallet data-icon="inline-start" />
              <AlertTitle>Signing wallet required</AlertTitle>
              <AlertDescription>
                Log in with the recovery phrase for the token genesis authority to edit project info.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden border-border/70 bg-white p-0 shadow-[0_28px_120px_-48px_rgba(0,0,0,0.85)] dark:bg-background sm:max-w-2xl">
          <DialogHeader className="shrink-0 gap-1.5 bg-white px-5 py-3.5 pr-14 dark:bg-background">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-xl tracking-tight">
                Project Info
              </DialogTitle>
              <Badge variant="outline" className="rounded-md px-2.5 py-1">
                {hasProjectInfoRecord ? "Update" : "Initialize"}
              </Badge>
            </div>
            <DialogDescription className="max-w-xl text-sm leading-6">
              {hasProjectInfoRecord
                ? "Update the public project details for this token."
                : "Publish the first public project details for this token."}
            </DialogDescription>
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              We may remove content we consider inappropriate at any time, without providing a reason or refund.
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white overscroll-contain dark:bg-background">
            <div className="flex flex-col gap-3.5 px-4 py-3.5 pb-4">
              {!hasSigningWallet ? (
                <Alert className="border-primary/20 bg-primary/5">
                  <Wallet data-icon="inline-start" />
                  <AlertTitle>Signing wallet required</AlertTitle>
                  <AlertDescription>
                    Guest-mode or address-only sessions cannot publish project info.
                  </AlertDescription>
                </Alert>
              ) : !isGenesisAuthPubkeyWallet ? (
                <Alert className="border-primary/20 bg-primary/5">
                  <Wallet data-icon="inline-start" />
                  <AlertTitle>Genesis key required</AlertTitle>
                  <AlertDescription>
                    The connected wallet must match this token's genesis authority public key.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-border/60 bg-white dark:bg-muted/15">
                  <CheckCircle2 data-icon="inline-start" />
                  <AlertTitle>Connected</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    <span>{formatAddress(ecashAddress || "")}</span>
                    <span>/</span>
                    <span>Genesis authority matched</span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-white p-3.5 dark:bg-background">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="token-project-info-description">Description</Label>
                    <span
                      className={cn(
                        "text-xs",
                        isDescriptionTooLong
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {descriptionByteLength}/{DESCRIPTION_MAX_BYTES} bytes
                    </span>
                  </div>
                  <Textarea
                    id="token-project-info-description"
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Short public project description"
                    className="min-h-[128px] rounded-lg border-border/60 bg-white text-sm shadow-none placeholder:text-muted-foreground/60 dark:bg-muted/10"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="token-project-info-website">Website</Label>
                  <Input
                    id="token-project-info-website"
                    value={formState.websiteUrl}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        websiteUrl: event.target.value,
                      }))
                    }
                    placeholder="https://example.com"
                    className="rounded-lg border-border/60 bg-white shadow-none dark:bg-muted/10"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="token-project-info-x">X</Label>
                  <Input
                    id="token-project-info-x"
                    value={formState.xUrl}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        xUrl: event.target.value,
                      }))
                    }
                    placeholder="https://x.com/project"
                    className="rounded-lg border-border/60 bg-white shadow-none dark:bg-muted/10"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="token-project-info-telegram">Telegram</Label>
                  <Input
                    id="token-project-info-telegram"
                    value={formState.telegramUrl}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        telegramUrl: event.target.value,
                      }))
                    }
                    placeholder="https://t.me/project"
                    className="rounded-lg border-border/60 bg-white shadow-none dark:bg-muted/10"
                  />
                </div>

                {isAnyUrlTooLong ? (
                  <p className="text-xs text-destructive">
                    Links must be at most {URL_MAX_CHARS} characters.
                  </p>
                ) : null}
              </div>

              {invoice ? (
                <div className="rounded-lg border border-border/60 bg-white p-3.5 dark:bg-muted/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Invoice status</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {invoice.status === "pending"
                          ? "Ready for payment"
                          : invoice.status === "tx_submitted"
                            ? "Payment txid submitted"
                            : invoice.status === "published"
                              ? "Published"
                              : invoice.status === "expired"
                                ? "Expired"
                                : "Invalid"}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-md px-2.5 py-1 uppercase">
                      {invoice.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-white p-3 dark:bg-background/75">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Amount
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {invoice.expectedPaidXec} XEC
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-white p-3 dark:bg-background/75">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Payment address
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-foreground/90">
                        {invoice.paymentAddress}
                      </p>
                    </div>
                  </div>

                  {invoice.paymentTxid ? (
                    <a
                      href={`https://explorer.e.cash/tx/${invoice.paymentTxid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      View payment transaction
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : null}

              {statusMessage ? (
                <Alert
                  className={cn(
                    "border-primary/20 bg-primary/5",
                    !isSubmitting && "border-border/60 bg-white dark:bg-muted/15",
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                  <AlertTitle>Processing</AlertTitle>
                  <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
              ) : null}

              {errorMessage ? (
                <Alert variant="destructive">
                  <MessageSquareText data-icon="inline-start" />
                  <AlertTitle>Submission failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-white px-4 py-3 dark:bg-background sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Fee: {submitFeeLabel}
            </div>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmitProjectInfo}
            >
              {isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {hasProjectInfoRecord ? "Publish Update" : "Initialize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default TokenProjectInfoCard
