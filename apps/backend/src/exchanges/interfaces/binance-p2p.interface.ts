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
