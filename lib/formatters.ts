export const formatNumber = (num: number | null | undefined, noDecimals: boolean = false): string => {
  if (num === null || num === undefined) return "0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (noDecimals) {
    return Math.round(num).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  }

  if (absNum >= 1e9) return sign + (absNum / 1e9).toFixed(3) + 'B';
  if (absNum >= 1e6) return sign + (absNum / 1e6).toFixed(2) + 'M';
  if (absNum >= 1e3) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num.toFixed(2);
};

export const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined) return "0";

  const roundedPrice = Math.round(price * 1e8) / 1e8;
  const absPrice = Math.abs(roundedPrice);
  const sign = roundedPrice < 0 ? '-' : '';

  if (absPrice >= 1 || Math.abs(absPrice - 1) < Number.EPSILON) {
    return sign + absPrice.toFixed(2);
  }

  if (absPrice >= 0.1) return sign + Number(absPrice.toFixed(3)).toString();
  if (absPrice >= 0.01) return sign + Number(absPrice.toFixed(5)).toString();
  return sign + Number(absPrice.toFixed(8)).toString();
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
  const absPrice = Math.abs(price);
  const sign = price < 0 ? '-' : '';

  if (!showUSD || !xecPrice) {
    let formattedPrice: string;
    if (absPrice >= 1) {
      formattedPrice = absPrice.toFixed(2);
    } else if (absPrice >= 0.01) {
      formattedPrice = absPrice.toFixed(3);
    } else if (absPrice >= 0.001) {
      formattedPrice = absPrice.toFixed(4);
    } else if (absPrice >= 0.0001) {
      formattedPrice = absPrice.toFixed(5);
    } else {
      formattedPrice = absPrice.toFixed(10);
    }

    const parts = formattedPrice.split('.');
    if (parts.length === 2) {
      const integerPart = parts[0];
      let decimalPart = parts[1].replace(/0+$/, '');

      if (decimalPart.length < 2) {
        decimalPart = decimalPart.padEnd(2, '0');
      }

      return sign + `${integerPart}.${decimalPart}`;
    }

    return sign + formattedPrice;
  }

  const usdValue = absPrice * xecPrice;
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

  return sign + formattedUsdPrice.replace(/\.?0+$/, '');
};
