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
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsImageCleanupService } from './transactions-image-cleanup.service';
import { TransactionsBinanceConvertService } from './transactions-binance-convert.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { SyncTransactionsDto } from './dto/sync-transactions.dto';
import { UpdateTransactionDto } from './dto/update-status.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly cleanupService: TransactionsImageCleanupService,
    private readonly binanceConvert: TransactionsBinanceConvertService,
  ) {}

  /** USDC sitting in the funding wallet, waiting to be swept into USDT. */
  @Get('usdc-balance')
  async usdcBalance() {
    return { usdc: await this.binanceConvert.getBalance() };
  }

  /**
   * Converts USDC to USDT by hand. Without `amount` it sweeps the whole balance,
   * which is what the sync does on its own when a deposit lands.
   */
  @Post('convert-usdc')
  async convertUsdc(@Query('amount') amount?: string) {
    const parsed = amount === undefined ? undefined : Number(amount);

    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      throw new BadRequestException('amount must be a positive number');
    }

    const result = await this.binanceConvert.convertUsdcToUsdt(parsed);
    return result ?? { converted: false, reason: 'nothing above the minimum' };
  }

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
