"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DollarSign } from "lucide-react"
import { useXECPrice } from "@/lib/price"
import { formatNumber, formatPrice } from "@/lib/formatters"
import { getRelativeTime, formatTime } from "@/lib/time-utils"
import { Transaction, TokenComponentProps } from "@/lib/types"
import { TOKEN_IDS, PRICE_CONSTANTS, UPDATE_INTERVALS, UI_CONSTANTS } from "@/lib/constants"
import { fetchAgoraTransactionsFromChronik } from "@/lib/chronik-transactions"
import { watchAgoraTokens } from "@/lib/agora-ws"

const getMaxAmount = (data: Transaction[]): number => {
  if (data.length === 0) return 0
  return Math.max(...data.map(t => t.amount))
}

export default function Component({ tokenId }: TokenComponentProps) {
  const [data, setData] = React.useState<Transaction[]>([])
  const [lastUpdate, setLastUpdate] = React.useState<string>("")
  const [showUSD, setShowUSD] = React.useState(false)
  const fetchIdRef = React.useRef(0)
  const xecPrice = useXECPrice()

  const maxAmount = React.useMemo(() => getMaxAmount(data), [data])

  const toggleShowUSD = React.useCallback(() => {
    setShowUSD(prev => !prev)
  }, [])

  const columns: ColumnDef<Transaction>[] = React.useMemo(() => [
    {
      accessorKey: "time",
      header: "Time",
      cell: ({ row }) => {
        const timestamp = row.original.timestamp;
        return (
          <div className="text-left" title={formatTime(timestamp)}>
            {getRelativeTime(timestamp)}
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: () => (
        <div className="flex items-center gap-2">
          <span>Price ({showUSD ? 'USD' : 'XEC'})</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleShowUSD()
            }}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <DollarSign className={`h-4 w-4 ${showUSD ? 'text-green-500' : 'text-muted-foreground'}`} />
          </button>
        </div>
      ),
      cell: ({ row, table }) => {
        const currentPrice = row.original?.price ?? 0
        const data = table.options.data as Transaction[]
        const currentIndex = data.findIndex(t => t.timestamp === row.original.timestamp)
        const prevPrice = currentIndex < data.length - 1 ? data[currentIndex + 1].price : currentPrice
        
        const isLastRow = currentIndex === data.length - 1
        const priceRatio = prevPrice > 0 ? currentPrice / prevPrice : 1
        const isPriceUp = isLastRow || priceRatio >= PRICE_CONSTANTS.PRICE_RATIO_THRESHOLD
        const colorClass = isPriceUp
          ? "dark:text-green-500 dark:hover:text-green-700" 
          : "dark:text-pink-400 dark:hover:text-pink-600"

        const displayPrice = showUSD 
          ? formatPrice(currentPrice * xecPrice)
          : formatPrice(currentPrice)

        return (
          <div className={`text-left ${colorClass}`}>
            {displayPrice}
          </div>
        )
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.original?.amount ?? 0
        const percentage = maxAmount > 0 
          ? Math.min((amount / maxAmount) * 100 * UI_CONSTANTS.AMOUNT_BAR_MULTIPLIER, 100)
          : 0
        
        return (
          <div className="relative flex items-center min-w-[60px] sm:min-w-[100px]">
            <div 
              className="absolute h-full bg-green-500/50" 
              style={{ 
                width: `${percentage}%`,
                height: '24px',
                borderRadius: '4px',
              }}
            />
            <span className="relative z-10 pl-2">
              {formatNumber(amount)}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "total",
      header: "Total (XEC)",
      cell: ({ row }) => (
        <div className="text-left">
          {formatNumber(row.original.price * row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: "txid",
      header: "TxID",
      cell: ({ row }) => (
        <a 
          href={`https://explorer.e.cash/tx/${row.original.txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-left font-mono text-blue-500 hover:text-blue-700 hover:underline"
        >
          {row.original.txid.substring(0, 4)}
        </a>
      ),
    },
  ], [showUSD, xecPrice, maxAmount, toggleShowUSD])

  React.useEffect(() => {
    const fetchData = async () => {
      const fetchId = ++fetchIdRef.current
      const collected: Transaction[] = []

      try {
        await fetchAgoraTransactionsFromChronik(
          tokenId,
          (batch) => {
            if (fetchIdRef.current !== fetchId) return
            collected.push(...batch)
            collected.sort((a, b) => b.timestamp - a.timestamp)
            setData([...collected])
            setLastUpdate(new Date().toLocaleString())
          },
          { pageSize: 100 },
        )

        if (fetchIdRef.current !== fetchId) return
        collected.sort((a, b) => b.timestamp - a.timestamp)
        setData([...collected])
        setLastUpdate(new Date().toLocaleString())
      } catch (_error) {}
    }

    fetchData()
    
    const unwatch = watchAgoraTokens([tokenId], (updatedTokenId) => {
      if (updatedTokenId === tokenId) {
        fetchData()
      }
    })
    
    const interval = setInterval(() => {
      setData(prevData => [...prevData])
    }, UPDATE_INTERVALS.ONE_MINUTE)
    
    return () => {
      fetchIdRef.current += 1
      unwatch()
      clearInterval(interval)
    }
  }, [tokenId])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card className="">
      <CardHeader className="p-2">
      </CardHeader>
      <CardContent>
        <div className="rounded-md">
          <Table className="border-none">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-none"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Last Updated: {lastUpdate}
      </CardFooter>
    </Card>
  )
}