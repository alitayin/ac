import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { tokens } from '@/config/tokens';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Trash2 } from "lucide-react";
import { fetchUserListings } from "@/lib/agora-orders";
import { cancelAgoraOffer } from "ecash-quicksend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Listing {
  price: number;
  amount: number;
  total: number;
  makerAddress?: string;
  tokenId: string;
  tokenName: string;
  rawOffer: any;
}

interface ListingListProps {
  ecashAddress: string;
  mnemonic: string;
}

export function ListingList({ ecashAddress, mnemonic }: ListingListProps) {
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const [availableTokens, setAvailableTokens] = useState<Array<{id: string, name: string}>>([]);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [listingToCancel, setListingToCancel] = useState<Listing | null>(null);

  const loadListings = async () => {
    if (!mnemonic || !ecashAddress) {
      setListings([]);
      setAvailableTokens([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetchUserListings(mnemonic);

      if (response.success && response.data) {
        setListings(response.data.listings);

        // Extract unique tokens for filter
        const tokenSet = new Set<string>();
        const tokenList: Array<{id: string, name: string}> = [];

        response.data.listings.forEach(listing => {
          if (!tokenSet.has(listing.tokenId)) {
            tokenSet.add(listing.tokenId);
            tokenList.push({
              id: listing.tokenId,
              name: listing.tokenName
            });
          }
        });

        setAvailableTokens(tokenList);
      } else {
        toast({
          title: "Failed to load listings",
          description: response.error || "Unknown error",
          variant: "destructive",
        });
        setListings([]);
        setAvailableTokens([]);
      }
    } catch (error) {
      toast({
        title: "Error loading listings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setListings([]);
      setAvailableTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, [ecashAddress, mnemonic]);

  const handleCancelClick = (listing: Listing) => {
    setListingToCancel(listing);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!listingToCancel || !mnemonic) return;

    const listingKey = `${listingToCancel.tokenId}-${listingToCancel.price}`;
    setIsCancelling(listingKey);

    try {
      // Wrap the raw offer in the format ecash-quicksend expects
      const wrappedOffer = {
        offer: listingToCancel.rawOffer,
        pricePerToken: listingToCancel.price,
        totalTokenAmount: BigInt(Math.floor(listingToCancel.amount * Math.pow(10, 0))), // Will need proper decimals
        totalXEC: listingToCancel.total,
        offerType: listingToCancel.rawOffer.variant?.type || 'PARTIAL'
      };

      const result = await cancelAgoraOffer(wrappedOffer, { mnemonic });

      if (result.success) {
        toast({
          title: "Listing cancelled",
          description: `Successfully cancelled listing for ${listingToCancel.tokenName}`,
        });

        // Immediately remove from UI
        setListings(prevListings =>
          prevListings.filter(l =>
            !(l.tokenId === listingToCancel.tokenId && l.price === listingToCancel.price)
          )
        );

        // Reload listings in background to sync
        setTimeout(() => loadListings(), 2000);
      } else {
        toast({
          title: "Failed to cancel listing",
          description: result.message || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error cancelling listing",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(null);
      setCancelDialogOpen(false);
      setListingToCancel(null);
    }
  };

  const filteredListings = listings.filter(listing => {
    if (tokenFilter === "all") return true;
    return listing.tokenId === tokenFilter;
  });

  const getTokenIcon = (tokenId: string) => {
    return `https://icons.etokens.cash/32/${tokenId}.png`;
  };

  if (!ecashAddress || !mnemonic) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground">Please connect your wallet to view your listings</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={tokenFilter} onValueChange={setTokenFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tokens</SelectItem>
              {availableTokens.map(token => (
                <SelectItem key={token.id} value={token.id}>
                  {token.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadListings}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground">Loading listings...</div>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground">
            {tokenFilter === "all"
              ? "No active listings found"
              : "No listings for this token"}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredListings.map((listing, index) => {
            const listingKey = `${listing.tokenId}-${listing.price}`;
            const isCancellingThis = isCancelling === listingKey;

            return (
              <Card key={`${listing.tokenId}-${index}`} className="rounded-3xl p-4 bg-background hover:bg-muted/30 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarImage src={getTokenIcon(listing.tokenId)} alt={listing.tokenName} />
                      <AvatarFallback>{listing.tokenName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{listing.tokenName}</div>
                      <div className="text-sm text-muted-foreground">
                        <a
                          href={`https://cashtab.com/#/token/${listing.tokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          View on Cashtab
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-muted-foreground">
                      {listing.price.toFixed(8)} XEC
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-muted/30">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Amount</div>
                      <div className="font-medium">{listing.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Total Value</div>
                      <div className="font-medium">{listing.total.toLocaleString()} XEC</div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelClick(listing)}
                      disabled={isCancellingThis}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {isCancellingThis ? 'Cancelling...' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this listing for {listingToCancel?.tokenName}?
              <br />
              <br />
              Amount: {listingToCancel?.amount.toLocaleString()}
              <br />
              Price: {listingToCancel?.price.toFixed(8)} XEC per token
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm}>
              Yes, cancel listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
