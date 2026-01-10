import { Button } from "@/components/ui/button";
import { ClipboardCopy, Download } from "lucide-react";

interface MnemonicActionsProps {
  mnemonicWords: string[];
}

export function MnemonicActions({ mnemonicWords }: MnemonicActionsProps) {
  const fullMnemonic = mnemonicWords.join(" ").trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullMnemonic);
      // Avoid using toast here; keep the component focused on actions only
    } catch (error) {
      console.error("Failed to copy mnemonic:", error);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([fullMnemonic], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agora-wallet-recovery-phrase.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download mnemonic:", error);
    }
  };

  if (!fullMnemonic) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        variant="outline"
        className="flex-1 flex items-center justify-center gap-2"
        onClick={handleCopy}
      >
        <ClipboardCopy className="h-4 w-4" />
        <span>Copy recovery phrase</span>
      </Button>
      <Button
        variant="outline"
        className="flex-1 flex items-center justify-center gap-2"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" />
        <span>Download as .txt</span>
      </Button>
    </div>
  );
}






