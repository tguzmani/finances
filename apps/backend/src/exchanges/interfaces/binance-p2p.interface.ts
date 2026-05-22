export interface BinanceP2PTrade {
  orderNumber: string;
  advNo: string;
  tradeType: string;
  asset: string;
  fiat: string;
  fiatSymbol: string;
  amount: string;
  totalPrice: string;
  unitPrice: string;
  orderStatus: string;
  createTime: number;
  commission: string;
  counterPartNickName: string;
  advertisementRole: string;
}

export interface BinanceP2PResponse {
  code: string;
  message: string | null;
  data: BinanceP2PTrade[];
  total: number;
  success: boolean;
}

// P2P Market Offers (current offers, not historical trades)
export interface BinanceP2POffer {
  adv: {
    advNo: string;
    price: string;
    tradableQuantity: string;
    minSingleTransAmount: string;
    maxSingleTransAmount: string;
  };
  advertiser: {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
  };
}

export interface BinanceP2POffersResponse {
  code: string;
  message: string | null;
  data: BinanceP2POffer[];
  total: number;
  success: boolean;
}
