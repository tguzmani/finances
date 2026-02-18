# Edit Telegram Message Strategy

## Overview
In multi-step Telegram bot flows, use the **edit strategy**: instead of sending a new message for each step, edit the existing message. This keeps the chat clean and prevents message spam.

## Pattern

### First message: `ctx.reply()` (new message)
The flow starts by sending a new message. This becomes the "main message" that gets edited in subsequent steps.

### Subsequent steps: `ctx.editMessageText()` (edit same message)
When the user clicks an inline button, edit the same message with the new content and keyboard.

### Text input breaks the chain
When the user types text (e.g., a description), a new message is created by the user. After processing the text input, the next bot response must be a `ctx.reply()` (new message), which then becomes the new "main message" for further editing.

## Implementation

```typescript
// Helper method pattern - accepts editMode parameter
private async showStep(ctx: SessionContext, editMode = false) {
  const message = 'Step content here';
  const keyboard = Markup.inlineKeyboard([...]);

  if (editMode) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }
}
```

## Flow Entry Points

| Trigger | editMode |
|---------|----------|
| Command (e.g., `/group`) | `false` (new message) |
| Inline button callback | `true` (edit existing) |
| After text input | `false` (new message, since user's text created a new message) |

## Key Rules

1. Always use `parse_mode: 'HTML'` for consistency
2. Inline keyboards are required for edit strategy - they stay attached to the edited message
3. The `ctx.editMessageText()` automatically targets the message that contains the clicked button
4. Clean up session state when the flow ends (cancel, done, or error)
5. Handle session expiry gracefully - if group/flow ID is missing, prompt user to restart
