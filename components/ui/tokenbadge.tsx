import * as React from "react"
import { cn } from "@/lib/utils"
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TokenBadgeProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  gradient?: boolean;
  pinnedStyle?: boolean;
  customClass?: string;
  popoverWidth?: string;
  icon?: React.ReactNode;
}

export const TokenBadge = ({ 
  label, 
  description,
  gradient = false,
  pinnedStyle = false,
  customClass = "",
  popoverWidth = "w-64",
  icon
}: TokenBadgeProps) => {
  const content = (
    <div onClick={(e) => e.stopPropagation()}>
      <AnimatedGradientText 
        className={cn(
          "inline-flex items-center rounded-md px-2.5 py-0.5 font-semibold text-xs",
          icon && "gap-1",
          pinnedStyle && "[--bg-size:300%] shadow-[inset_0_-8px_10px_#67e8f91f] hover:shadow-[inset_0_-5px_10px_#67e8f93f]",
          customClass
        )}
      >
        {pinnedStyle && (
          <div className="absolute inset-0 block h-full w-full animate-gradient bg-gradient-to-r from-[#67e8f9]/50 via-[#ff8acd]/50 to-[#67e8f9]/50 bg-[length:var(--bg-size)_100%] p-[1px] ![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]" />
        )}
        {icon}
        <span
          className={cn(
            gradient && "inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent"
          )}
        >
          {label}
        </span>
      </AnimatedGradientText>
    </div>
  );

  if (!description) {
    return content;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {content}
      </PopoverTrigger>
      <PopoverContent className={popoverWidth} onClick={(e) => e.stopPropagation()}>
        {description}
      </PopoverContent>
    </Popover>
  );
};

