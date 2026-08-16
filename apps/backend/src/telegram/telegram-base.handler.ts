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
   * Strips the inline keyboard from the message a button belongs to, so a
   * decision that was already taken cannot be taken again. Editing fails when
   * the message is gone or carries no keyboard, which is not worth surfacing.
   */
  async removeButtons(ctx: SessionContext): Promise<void> {
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      // The decision stands regardless of whether the keyboard could be cleared
    }
  }

  /**
   * Runs work that takes a noticeable while (an LLM round trip) with the chat
   * showing "typing...", so the user sees the bot is busy instead of silence.
   * Telegram clears the indicator after about five seconds, so it is resent
   * until the work settles.
   */
  async withTyping<T>(ctx: SessionContext, work: () => Promise<T>): Promise<T> {
    let result!: T;
    let failure: unknown;

    // persistentChatAction swallows the callback's result, so it is captured here
    await ctx.persistentChatAction('typing', async () => {
      try {
        result = await work();
      } catch (error) {
        failure = error;
      }
    });

    if (failure) throw failure;
    return result;
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
