export interface AssetBalance {
  asset: string;
  totalBalance: number;
  breakdown: {
    funding: number;
    earn: number;
  };
}

export interface StablecoinOverview {
  assets: AssetBalance[];
  totalBalance: number;
}
