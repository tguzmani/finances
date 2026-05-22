import { IsEnum, IsOptional, IsString, IsDate, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionStatus } from '../transaction.types';

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
