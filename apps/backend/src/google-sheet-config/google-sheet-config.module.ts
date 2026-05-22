import { Module } from '@nestjs/common';
import { GoogleSheetConfigService } from './google-sheet-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GoogleSheetConfigService],
  exports: [GoogleSheetConfigService],
})
export class GoogleSheetConfigModule {}
