import { Injectable } from '@nestjs/common';
import { SessionContext } from './telegram.types';

@Injectable()
export class TelegramBaseHandler {
  /**
   * Builds progress text for review titles
   */
  buildProgressText(currentIndex?: number, totalCount?: number): string {
    if (!totalCount || !currentIndex) {
      return '';
    }
    return ` - ${currentIndex}/${totalCount}`;
  }

  /**
   * Clears the session context
   */
  clearSession(ctx: SessionContext): void {
    ctx.session = {};
  }

  /**
   * Gets the review type from session
   */
  getReviewTypeFromSession(ctx: SessionContext): 'transactions' | 'exchanges' | null {
    return ctx.session.reviewType || null;
  }

  /**
   * Checks if there is review history
   */
  hasReviewHistory(ctx: SessionContext, type: 'transactions' | 'exchanges'): boolean {
    if (type === 'transactions') {
      return !!(ctx.session.transactionReviewHistory && ctx.session.transactionReviewHistory.length > 0);
    }
    return !!(ctx.session.exchangeReviewHistory && ctx.session.exchangeReviewHistory.length > 0);
  }

  /**
   * Adds current ID to review history
   */
  addToReviewHistory(ctx: SessionContext, type: 'transactions' | 'exchanges', id: number): void {
    if (type === 'transactions') {
      if (!ctx.session.transactionReviewHistory) {
        ctx.session.transactionReviewHistory = [];
      }
      ctx.session.transactionReviewHistory.push(id);
    } else {
      if (!ctx.session.exchangeReviewHistory) {
        ctx.session.exchangeReviewHistory = [];
      }
      ctx.session.exchangeReviewHistory.push(id);
    }
  }

  /**
   * Pops from review history and returns the previous ID
   */
  popFromReviewHistory(ctx: SessionContext, type: 'transactions' | 'exchanges'): number | null {
    if (type === 'transactions') {
      const history = ctx.session.transactionReviewHistory || [];
      if (history.length === 0) return null;
      const previousId = history.pop();
      ctx.session.transactionReviewHistory = history;
      return previousId || null;
    } else {
      const history = ctx.session.exchangeReviewHistory || [];
      if (history.length === 0) return null;
      const previousId = history.pop();
      ctx.session.exchangeReviewHistory = history;
      return previousId || null;
    }
  }

  /**
   * Increments review progress index
   */
  incrementReviewIndex(ctx: SessionContext): void {
    ctx.session.reviewCurrentIndex = (ctx.session.reviewCurrentIndex || 0) + 1;
  }

  /**
   * Decrements review progress index
   */
  decrementReviewIndex(ctx: SessionContext): void {
    ctx.session.reviewCurrentIndex = (ctx.session.reviewCurrentIndex || 1) - 1;
  }

  /**
   * Initializes review progress tracking
   */
  initializeReviewProgress(ctx: SessionContext, totalCount: number): void {
    ctx.session.reviewTotalCount = totalCount;
    ctx.session.reviewCurrentIndex = 0; // Will be incremented to 1 when showing first item
  }
}
