export const TIME_CONSTANTS = {
  JUST_NOW_THRESHOLD: 60,
  MINUTES_IN_HOUR: 3600,
  HOURS_IN_DAY: 86400,
} as const;

export const getRelativeTime = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < TIME_CONSTANTS.JUST_NOW_THRESHOLD) return 'just now';
  if (diff < TIME_CONSTANTS.MINUTES_IN_HOUR) return `${Math.floor(diff / 60)}m ago`;
  if (diff < TIME_CONSTANTS.HOURS_IN_DAY) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day}, ${hours}:${minutes}`;
};

export const getLastNDays = (days: number): string[] => {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    return date.toISOString().split("T")[0];
  });
};

export const parseUTCDate = (dateStr: string): Date => {
  return new Date(dateStr + 'Z');
};

export const formatDateShort = (dateStr: string): string => {
  const date = parseUTCDate(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
};

