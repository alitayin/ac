import Header from "@/components/ui/header";
import { SwapPanel } from "./SwapPanel";

type SwapPageProps = {
  searchParams?: {
    tokenId?: string;
    tokenName?: string;
  };
};

export default function SwapPage({ searchParams }: SwapPageProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SwapPanel
        initialTokenId={searchParams?.tokenId}
        initialTokenName={searchParams?.tokenName}
      />
    </div>
  );
}
