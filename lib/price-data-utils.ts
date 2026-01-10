import { RealtimePriceData } from './types';
import { PRICE_CONSTANTS, CHART_CONSTANTS } from './constants';
import { parseUTCDate } from './time-utils';

export const limitPriceChange = (price: number, prevPrice: number): number => {
  if (prevPrice === 0) return price;
  
  const changePercent = ((price - prevPrice) / prevPrice) * 100;
  
  if (changePercent > PRICE_CONSTANTS.MAX_INCREASE_PERCENT) {
    return prevPrice * PRICE_CONSTANTS.MAX_INCREASE_MULTIPLIER;
  } else if (changePercent < -PRICE_CONSTANTS.MAX_DECREASE_PERCENT) {
    return prevPrice * PRICE_CONSTANTS.MIN_DECREASE_MULTIPLIER;
  }
  return price;
};

export const createEmptyDataPoint = (date: string, price: number): RealtimePriceData => ({
  date,
  amount: 0,
  token: 0,
  matchedTxCount: 0,
  totalTxCount: 0,
  averagePrice: price,
  latestPrice: price
});

export const processPriceData = (data: RealtimePriceData[], addEmptyDays = false): RealtimePriceData[] => {
  const filteredData = data.filter(item => {
    const date = new Date(item.date);
    return date >= new Date(CHART_CONSTANTS.DATE_CUTOFF);
  });

  if (filteredData.length === 0) return [];

  const firstValidPrice = filteredData.find(item => item.amount > 0)?.averagePrice || 0;
  let lastValidPrice = firstValidPrice;

  let processedData = [...filteredData];
  
  if (processedData.length > 1) {
    const filledData: RealtimePriceData[] = [];
    for (let i = 0; i < processedData.length - 1; i++) {
      const currentDate = parseUTCDate(processedData[i].date);
      const nextDate = parseUTCDate(processedData[i + 1].date);
      
      filledData.push(processedData[i]);
      
      const hoursDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60));
      
      if (hoursDiff > 1) {
        const currentPrice = processedData[i].averagePrice;
        for (let h = 1; h < hoursDiff; h++) {
          const fillDate = new Date(currentDate);
          fillDate.setHours(currentDate.getHours() + h);
          filledData.push(createEmptyDataPoint(
            fillDate.toISOString().slice(0, 19).replace('T', ' '),
            currentPrice
          ));
        }
      }
    }
    filledData.push(processedData[processedData.length - 1]);
    processedData = filledData;
  }

  return processedData.map((item) => {
    if (item.amount === 0) {
      return {
        ...item,
        averagePrice: lastValidPrice,
        latestPrice: lastValidPrice
      };
    }

    const limitedAveragePrice = limitPriceChange(item.averagePrice, lastValidPrice);
    const limitedLatestPrice = limitPriceChange(item.latestPrice, lastValidPrice);

    lastValidPrice = limitedAveragePrice;

    return {
      ...item,
      averagePrice: limitedAveragePrice,
      latestPrice: limitedLatestPrice
    };
  });
};

export const aggregatePriceData = (
  data: RealtimePriceData[], 
  maxPoints: number = CHART_CONSTANTS.MAX_CHART_POINTS
): RealtimePriceData[] => {
  if (data.length <= maxPoints) return data;
  
  const aggregationFactor = Math.ceil(data.length / maxPoints);
  const aggregatedData: RealtimePriceData[] = [];
  let lastValidPrice = data[0]?.averagePrice || 0;
  
  for (let i = 0; i < data.length; i += aggregationFactor) {
    const chunk = data.slice(i, i + aggregationFactor);
    const totalAmount = chunk.reduce((sum, curr) => sum + curr.amount, 0);
    
    if (totalAmount === 0) {
      aggregatedData.push(createEmptyDataPoint(chunk[chunk.length - 1].date, lastValidPrice));
      continue;
    }
    
    const aggregatedPoint = chunk.reduce((acc, curr) => {
      const newAmount = acc.amount + curr.amount;
      const weightedPrice = newAmount > 0 
        ? (acc.amount * acc.averagePrice + curr.amount * curr.averagePrice) / newAmount 
        : lastValidPrice;
      
      return {
        date: curr.date,
        amount: newAmount,
        token: acc.token + curr.token,
        matchedTxCount: acc.matchedTxCount + curr.matchedTxCount,
        totalTxCount: acc.totalTxCount + curr.totalTxCount,
        averagePrice: weightedPrice,
        latestPrice: curr.latestPrice
      };
    }, createEmptyDataPoint(chunk[0].date, lastValidPrice));
    
    lastValidPrice = aggregatedPoint.averagePrice;
    aggregatedData.push(aggregatedPoint);
  }
  
  return aggregatedData;
};

export const formatChartAmount = (amount: number): string => {
  const normalizedAmount = amount / CHART_CONSTANTS.AMOUNT_DIVISOR;
  
  if (normalizedAmount >= 1e9) {
    return (normalizedAmount / 1e9).toFixed(1) + 'b';
  } else if (normalizedAmount >= 1e6) {
    return (normalizedAmount / 1e6).toFixed(1) + 'm';
  } else if (normalizedAmount >= 1e3) {
    return (normalizedAmount / 1e3).toFixed(1) + 'k';
  }
  return normalizedAmount.toString();
};


