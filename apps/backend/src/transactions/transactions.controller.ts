import {
  Controller,
  Delete,
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
import { TransactionsImageCleanupService } from './transactions-image-cleanup.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { SyncTransactionsDto } from './dto/sync-transactions.dto';
import { UpdateTransactionDto } from './dto/update-status.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly cleanupService: TransactionsImageCleanupService,
  ) {}

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

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto
  ) {
    return this.transactionsService.update(id, dto);
  }

  @Delete('tests')
  deleteTestTransactions() {
    return this.transactionsService.deleteTestTransactions();
  }

  @Post('cleanup-images')
  cleanupOrphanedImages() {
    return this.cleanupService.cleanupOrphanedImages();
  }
}
