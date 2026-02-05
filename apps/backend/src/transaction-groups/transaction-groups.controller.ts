import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { TransactionGroupsService } from './transaction-groups.service';
import { CreateTransactionGroupDto } from './dto/create-transaction-group.dto';
import { UpdateTransactionGroupDto } from './dto/update-transaction-group.dto';

@Controller('transaction-groups')
export class TransactionGroupsController {
  constructor(private readonly transactionGroupsService: TransactionGroupsService) {}

  @Post()
  create(@Body() createDto: CreateTransactionGroupDto) {
    return this.transactionGroupsService.createGroupWithTransactions(
      createDto.description,
      createDto.transactionIds,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionGroupsService.findOneWithTransactions(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateTransactionGroupDto) {
    return this.transactionGroupsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.transactionGroupsService.delete(id);
  }

  @Get(':id/amount')
  calculateAmount(@Param('id', ParseIntPipe) id: number) {
    return this.transactionGroupsService.calculateGroupAmount(id);
  }

  @Get(':id/date')
  async calculateDate(@Param('id', ParseIntPipe) id: number) {
    const date = await this.transactionGroupsService.calculateGroupDate(id);
    return { date };
  }
}
