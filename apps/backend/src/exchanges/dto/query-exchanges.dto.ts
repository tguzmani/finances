import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TradeType, ExchangeStatus } from '../exchange.types';

export class QueryExchangesDto {
  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsEnum(TradeType)
  tradeType?: TradeType;

  @IsOptional()
  @IsEnum(ExchangeStatus)
  status?: ExchangeStatus;

  @IsOptional()
  @IsString()
  asset?: string;
}
