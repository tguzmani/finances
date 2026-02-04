import { IsEnum } from 'class-validator';
import { TransactionStatus } from '../transaction.types';

export class UpdateStatusDto {
  @IsEnum(TransactionStatus)
  status: TransactionStatus;
}
