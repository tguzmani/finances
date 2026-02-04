import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { SyncTransactionsDto } from './dto/sync-transactions.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(@Query() query: QueryTransactionsDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const transaction = await this.transactionsService.findOne(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return transaction;
  }

  @Post('sync')
  sync(@Query() query: SyncTransactionsDto) {
    return this.transactionsService.syncFromEmail(query.limit);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto
  ) {
    return this.transactionsService.updateStatus(id, dto.status);
  }
}
