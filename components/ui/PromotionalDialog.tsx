"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "promotional-dialog-dismissed-hash";
const ANNOUNCEMENTS = [
  "Happy New Year 2026! Wishing everyone a year filled with health, joy, and prosperity.",
];
const ANNOUNCEMENT_CONTENT = ANNOUNCEMENTS.join("||");
const ANNOUNCEMENT_HASH = hashContent(ANNOUNCEMENT_CONTENT);

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `v1-${Math.abs(hash)}`;
}

export default function PromotionalDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const storedHash = localStorage.getItem(STORAGE_KEY);
    if (storedHash === ANNOUNCEMENT_HASH) {
      return;
    }

    const timer = setTimeout(() => {
      setOpen(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleDontShowAgain = () => {
    localStorage.setItem(STORAGE_KEY, ANNOUNCEMENT_HASH);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[550px] p-0 border-0 bg-transparent shadow-none max-h-[90vh]">
        <div className="relative">
          <Card className="border overflow-hidden max-h-[90vh]">
            <BorderBeam duration={6} size={50} className="from-transparent via-muted-foreground/30 to-transparent" />
            <BorderBeam duration={6} delay={3} size={50} className="from-transparent via-muted-foreground/20 to-transparent" />
            
            <CardContent className="p-5 sm:p-6 max-h-[82vh] overflow-y-auto pr-2 sm:pr-4">
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-md text-center">
                  🎉 Happy New Year 2026
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <Card className="bg-muted/40">
                  <CardContent className="p-3.5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <p className="text-md text-foreground">Announcement</p>
                      </div>
                      <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground pl-6">
                        {ANNOUNCEMENTS.map((item, idx) => (
                          <p key={idx}>{item}</p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDontShowAgain}
                    className="text-sm h-8"
                  >
                    Don't show again
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="text-sm h-8"
                  >
                    Got it
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

