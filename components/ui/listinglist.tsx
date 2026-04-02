import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { tokens } from '@/config/tokens';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { fetchUserListings } from "@/lib/agora-orders";

interface Listing {
  price: number;
  amount: number;
  total: number;
  makerAddress?: string;
  tokenId: string;
  tokenName: string;
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
          {filteredListings.map((listing, index) => (
            <Card key={`${listing.tokenId}-${index}`} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getTokenIcon(listing.tokenId)} alt={listing.tokenName} />
                    <AvatarFallback>{listing.tokenName.substring(0, 2)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{listing.tokenName}</div>
                        <div className="text-sm text-muted-foreground">
                          {listing.tokenId.substring(0, 8)}...{listing.tokenId.substring(listing.tokenId.length - 8)}
                        </div>
                      </div>
                      <a
                        href={`https://cashtab.com/#/token/${listing.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 cursor-pointer">
                          View on Cashtab
                        </Badge>
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Amount</div>
                        <div className="font-medium">{listing.amount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Price</div>
                        <div className="font-medium">{listing.price.toFixed(8)} XEC</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-medium">{listing.total.toLocaleString()} XEC</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
