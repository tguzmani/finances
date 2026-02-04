import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ExchangesService } from './exchanges.service';
import { QueryExchangesDto } from './dto/query-exchanges.dto';
import { SyncExchangesDto } from './dto/sync-exchanges.dto';

@Controller('exchanges')
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  @Get()
  findAll(@Query() query: QueryExchangesDto) {
    return this.exchangesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.exchangesService.findOne(id);
  }

  @Post('sync')
  sync(@Query() dto: SyncExchangesDto) {
    return this.exchangesService.syncFromBinance(dto);
  }
}
