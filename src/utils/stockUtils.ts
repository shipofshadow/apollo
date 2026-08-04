export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'SOLD_OUT';

export function getStockStatus(stockQty: number | undefined, trackStock: boolean | undefined): StockStatus {
  if (!trackStock) {
    return 'IN_STOCK';
  }
  
  const qty = stockQty ?? 0;
  
  if (qty <= 0) {
    return 'SOLD_OUT';
  }
  
  if (qty <= 3) {
    return 'LOW_STOCK';
  }
  
  return 'IN_STOCK';
}

export function getStockBadgeConfig(status: StockStatus) {
  switch (status) {
    case 'SOLD_OUT':
      return { label: 'Sold Out', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    case 'LOW_STOCK':
      return { label: 'Low Stock', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    case 'IN_STOCK':
      return { label: 'In Stock', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
  }
}
