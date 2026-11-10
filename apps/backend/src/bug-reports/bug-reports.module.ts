import { Module } from '@nestjs/common';
import { BugReportService } from './bug-report.service';

@Module({
  providers: [BugReportService],
  exports: [BugReportService],
})
export class BugReportsModule {}
