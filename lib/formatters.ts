export const formatNumber = (num: number | null | undefined, noDecimals: boolean = false): string => {
  if (num === null || num === undefined) return "0";
  
  if (num >= 1e9) return (num / 1e9).toFixed(3) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return noDecimals ? Math.round(num).toString() : num.toFixed(2);
};

export const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined) return "0";
  
  const roundedPrice = Math.round(price * 1e8) / 1e8;
  
  if (roundedPrice >= 1 || Math.abs(roundedPrice - 1) < Number.EPSILON) {
    return roundedPrice.toFixed(2);
  }
  
  if (roundedPrice >= 0.1) return Number(roundedPrice.toFixed(3)).toString();
  if (roundedPrice >= 0.01) return Number(roundedPrice.toFixed(5)).toString();
  return Number(roundedPrice.toFixed(8)).toString();
};

export const shortenAddress = (address: string, chars: number = 3): string => {
  return address.slice(-chars);
};

export const getChartColor = (index: number): string => {
  const colorIndex = (index % 5) + 1;
  const opacity = index < 5 ? '1' : '0.9';
  return `hsla(var(--chart-${colorIndex}) / ${opacity})`;
};

export const convertPrice = (
  price: number,
  showUSD: boolean = false,
  xecPrice: number = 0
): string => {
  if (!showUSD || !xecPrice) {
    let formattedPrice: string;
    if (price >= 1) {
      formattedPrice = price.toFixed(2);
    } else if (price >= 0.01) {
      formattedPrice = price.toFixed(3);
    } else if (price >= 0.001) {
      formattedPrice = price.toFixed(4);
    } else if (price >= 0.0001) {
      formattedPrice = price.toFixed(5);
    } else {
      formattedPrice = price.toFixed(10);
    }
    
    const parts = formattedPrice.split('.');
    if (parts.length === 2) {
      const integerPart = parts[0];
      let decimalPart = parts[1].replace(/0+$/, '');
      
      if (decimalPart.length < 2) {
        decimalPart = decimalPart.padEnd(2, '0');
      }
      
      return `${integerPart}.${decimalPart}`;
    }
    
    return formattedPrice;
  }
  
  const usdValue = price * xecPrice;
  let formattedUsdPrice: string;
  
  if (usdValue >= 1) {
    formattedUsdPrice = usdValue.toFixed(2);
  } else if (usdValue >= 0.01) {
    formattedUsdPrice = usdValue.toFixed(4);
  } else if (usdValue >= 0.0001) {
    formattedUsdPrice = usdValue.toFixed(6);
  } else if (usdValue >= 0.000001) {
    formattedUsdPrice = usdValue.toFixed(8);
  } else {
    formattedUsdPrice = usdValue.toFixed(10);
  }
  
  return formattedUsdPrice.replace(/\.?0+$/, '');
};
