import { Injectable } from '@nestjs/common';
import { BugReport, BugReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The bug inbox. A report is filed from the chat the moment it is noticed, with
 * no triage and no form, because the alternative is forgetting it.
 *
 * Rows are closed from a development session, which writes the resolution and
 * leaves `notifiedAt` empty. The chat announces those on the next boot, so a
 * fix that ships is a fix the user hears about.
 */
@Injectable()
export class BugReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(text: string): Promise<BugReport> {
    return this.prisma.bugReport.create({ data: { text } });
  }

  /** Everything still waiting on a fix, oldest first. */
  async findOpen(): Promise<BugReport[]> {
    return this.prisma.bugReport.findMany({
      where: { status: BugReportStatus.OPEN },
      orderBy: { reportedAt: 'asc' },
    });
  }

  async findOne(id: number): Promise<BugReport | null> {
    return this.prisma.bugReport.findUnique({ where: { id } });
  }

  /** Closed rows whose resolution has not been announced in the chat yet. */
  async findUnannounced(): Promise<BugReport[]> {
    return this.prisma.bugReport.findMany({
      where: {
        status: { in: [BugReportStatus.FIXED, BugReportStatus.WONT_FIX] },
        notifiedAt: null,
      },
      orderBy: { resolvedAt: 'asc' },
    });
  }

  async resolve(
    id: number,
    status: BugReportStatus,
    resolution: string,
  ): Promise<BugReport> {
    return this.prisma.bugReport.update({
      where: { id },
      data: { status, resolution, resolvedAt: new Date(), notifiedAt: null },
    });
  }

  async markAnnounced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    await this.prisma.bugReport.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() },
    });
  }

  async discard(id: number): Promise<BugReport> {
    return this.prisma.bugReport.delete({ where: { id } });
  }
}
