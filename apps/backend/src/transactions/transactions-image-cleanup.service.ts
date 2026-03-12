import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { B2StorageService } from '../common/b2-storage.service';

export interface ImageCleanupResult {
  totalImages: number;
  orphanedImages: number;
  deletedImages: number;
}

@Injectable()
export class TransactionsImageCleanupService {
  private readonly logger = new Logger(TransactionsImageCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly b2Storage: B2StorageService,
  ) {}

  async cleanupOrphanedImages(): Promise<ImageCleanupResult> {
    const b2Keys = await this.b2Storage.listKeys('bills/');

    if (b2Keys.length === 0) {
      return { totalImages: 0, orphanedImages: 0, deletedImages: 0 };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });

    const referencedKeys = new Set(transactions.map(t => t.imageUrl));
    const orphanedKeys = b2Keys.filter(key => !referencedKeys.has(key));

    let deleted = 0;
    for (const key of orphanedKeys) {
      try {
        await this.b2Storage.deleteObject(key);
        deleted++;
      } catch (err) {
        this.logger.error(`Failed to delete orphaned image ${key}: ${(err as Error).message}`);
      }
    }

    return { totalImages: b2Keys.length, orphanedImages: orphanedKeys.length, deletedImages: deleted };
  }
}
