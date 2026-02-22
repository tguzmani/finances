import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ExpensesSheetsService } from './expenses-sheets.service';
import { ExpensesChartService } from './expenses-chart.service';

@Module({
  imports: [CommonModule],
  providers: [ExpensesSheetsService, ExpensesChartService],
  exports: [ExpensesSheetsService, ExpensesChartService],
})
export class ExpensesModule {}
