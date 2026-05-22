import { IsString, IsEnum, IsOptional } from 'class-validator';
import { TransactionGroupStatus } from '../transaction-group.types';

export class UpdateTransactionGroupDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TransactionGroupStatus)
  @IsOptional()
  status?: TransactionGroupStatus;
}
