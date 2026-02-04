import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransactionStatus } from '../transaction.types';

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  description?: string;
}
