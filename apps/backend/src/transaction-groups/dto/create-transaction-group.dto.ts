import { IsString, IsNotEmpty, IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class CreateTransactionGroupDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(2)
  transactionIds: number[];
}
