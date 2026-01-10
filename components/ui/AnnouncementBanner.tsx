"use client"
import { useState, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface AnnouncementBannerProps {
  message: string;
  link: string;
}

export default function AnnouncementBanner({ message, link }: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  const handleScroll = useCallback(() => {
    const shouldBeVisible = window.scrollY < 10;
    setIsVisible(shouldBeVisible);
  }, []);
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };
    
    window.addEventListener('scroll', debouncedHandleScroll);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', debouncedHandleScroll);
    };
  }, [handleScroll]);
  
  return (
    <Link href={link}>
      <div 
        className={`py-2 md:py-2.5 flex items-center justify-center bg-blue-600 text-white text-[10px] sm:text-xs md:text-sm font-medium border-b border-blue-500 cursor-pointer hover:bg-blue-700 transition-all duration-300 px-4 md:px-6 ${isVisible ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0 overflow-hidden'}`}
      >
        <div className="flex items-center">
          <span className="inline-flex flex-shrink-0 mr-1">✨</span>
          <div className="inline flex-wrap">
            <span className="inline">{message}</span>
            <ChevronRight className="h-4 w-4 inline-block ml-1 align-text-bottom hidden sm:inline-block" />
          </div>
        </div>
      </div>
    </Link>
  );
} 