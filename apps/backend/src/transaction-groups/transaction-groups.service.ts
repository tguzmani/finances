import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionGroup, Transaction, Prisma } from '@prisma/client';
import { TransactionGroupStatus, GroupAmountCalculation } from './transaction-group.types';
import { UpdateTransactionGroupDto } from './dto/update-transaction-group.dto';

@Injectable()
export class TransactionGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD Methods ====================

  async create(description: string): Promise<TransactionGroup> {
    return this.prisma.transactionGroup.create({
      data: {
        description,
        status: 'NEW',
      },
    });
  }

  async findOne(id: number): Promise<TransactionGroup | null> {
    return this.prisma.transactionGroup.findUnique({
      where: { id },
    });
  }

  async findOneWithTransactions(id: number): Promise<TransactionGroup & { transactions: Transaction[] }> {
    const group = await this.prisma.transactionGroup.findUnique({
      where: { id },
      include: {
        transactions: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Transaction group with ID ${id} not found`);
    }

    return group;
  }

  async update(id: number, dto: UpdateTransactionGroupDto): Promise<TransactionGroup> {
    const group = await this.findOne(id);
    if (!group) {
      throw new NotFoundException(`Transaction group with ID ${id} not found`);
    }

    return this.prisma.transactionGroup.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: number): Promise<void> {
    const group = await this.findOne(id);
    if (!group) {
      throw new NotFoundException(`Transaction group with ID ${id} not found`);
    }

    await this.prisma.transactionGroup.delete({
      where: { id },
    });
  }

  // ==================== Group Management ====================

  async createGroupWithTransactions(description: string, txIds: number[]): Promise<TransactionGroup> {
    if (txIds.length < 2) {
      throw new BadRequestException('A group must contain at least 2 transactions');
    }

    // Create group and link transactions in a transaction
    const group = await this.prisma.$transaction(async (prisma) => {
      const newGroup = await prisma.transactionGroup.create({
        data: {
          description,
          status: 'NEW',
        },
      });

      await prisma.transaction.updateMany({
        where: {
          id: { in: txIds },
        },
        data: {
          groupId: newGroup.id,
        },
      });

      return newGroup;
    });

    return group;
  }

  async addTransactionToGroup(transactionId: number, groupId: number): Promise<void> {
    const group = await this.findOne(groupId);
    if (!group) {
      throw new NotFoundException(`Transaction group with ID ${groupId} not found`);
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        groupId,
      },
    });
  }

  async removeTransactionFromGroup(transactionId: number): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        groupId: null,
      },
    });
  }

  async getGroupMemberCount(groupId: number): Promise<number> {
    const count = await this.prisma.transaction.count({
      where: {
        groupId,
      },
    });

    return count;
  }

  // ==================== Registration Queries ====================

  async findGroupsForRegistration(): Promise<(TransactionGroup & { transactions: Transaction[] })[]> {
    return this.prisma.transactionGroup.findMany({
      where: {
        status: 'NEW',
      },
      include: {
        transactions: true,
      },
    });
  }

  // ==================== Calculations ====================

  async calculateGroupDate(groupId: number): Promise<Date> {
    const group = await this.findOneWithTransactions(groupId);

    if (group.transactions.length === 0) {
      throw new BadRequestException('Group has no transactions');
    }

    const dates = group.transactions.map(t => new Date(t.date).getTime());
    return new Date(Math.min(...dates));
  }

  async calculateGroupAmount(groupId: number, exchangeRate?: number): Promise<GroupAmountCalculation> {
    const group = await this.findOneWithTransactions(groupId);

    if (group.transactions.length === 0) {
      throw new BadRequestException('Group has no transactions');
    }

    // Check currency mix
    const currencies = new Set(group.transactions.map(t => t.currency));
    const isMixed = currencies.size > 1;
    const hasVES = currencies.has('VES');

    let sumIncome = 0;
    let sumExpense = 0;

    for (const tx of group.transactions) {
      let amount = Number(tx.amount);

      // Convert VES to USD if mixed or if exchange rate provided
      if (tx.currency === 'VES' && (isMixed || exchangeRate)) {
        if (!exchangeRate) {
          throw new BadRequestException('Exchange rate required for VES transactions');
        }
        amount = amount / exchangeRate;
      }

      if (tx.type === 'INCOME') {
        sumIncome += amount;
      } else {
        sumExpense += amount;
      }
    }

    const net = sumIncome - sumExpense;
    const totalAmount = Math.abs(net);
    const type = net > 0 ? 'INCOME' : net < 0 ? 'EXPENSE' : 'NEUTRAL';

    const currency = isMixed ? 'MIXED' : (hasVES ? 'VES' : 'USD');

    return {
      totalAmount,
      currency,
      type,
      hasMonetaryValue: totalAmount > 0,
      excelFormula: this.buildExcelFormula(group.transactions, exchangeRate, currency),
    };
  }

  private buildExcelFormula(transactions: Transaction[], exchangeRate?: number, groupCurrency?: string): string {
    const terms: string[] = [];

    for (const tx of transactions) {
      const amount = Number(tx.amount).toFixed(2);
      const sign = tx.type === 'INCOME' ? '+' : '-';
      terms.push(`${sign}${amount}`);
    }

    const sumExpr = terms.join('');

    // Only divide by exchange rate if ALL transactions are VES (not mixed, not USD)
    if (exchangeRate && groupCurrency === 'VES') {
      return `=abs((${sumExpr})/${exchangeRate.toFixed(2)})`;
    }

    return `=abs(${sumExpr})`;
  }

  // ==================== Validation ====================

  async validateCanUngroup(transactionId: number): Promise<boolean> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    return transaction?.groupId !== null;
  }
}
