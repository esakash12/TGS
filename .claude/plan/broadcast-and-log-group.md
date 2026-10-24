# Implementation Plan: Telegram Broadcast & Optional Real-Time Log Group

### Task Type
- [x] Fullstack (Backend Telegram Engine + Frontend Broadcast Center & Settings)

### Summary
Comprehensive architecture for:
1. **Telegram Customer Broadcast Engine**:
   - Custom announcement notices to all bot users.
   - Price Drop (📉) and Price Update (🔥) notifications with live Was/Now pricing.
   - Rate-limited (25 msgs/sec) batching queue to prevent Telegram 429 limits.
   - Telegram live bubble preview and 1-click buy inline buttons.
2. **Optional Public/Private Log Group / Channel**:
   - Matches the VEXORIX BOT LOGS specification provided by user.
   - Real-time purchase announcements (💥 New Purchase!).
   - Real-time deposit announcements (💰 New Deposit / Topup).
   - Data privacy masking for customer IDs and transaction codes.
   - 100% fail-safe and optional.

### Key Files
| File | Operation | Description |
|---|---|---|
| `server/src/db/database.ts` | Modify | Schema migration for log channel columns and `broadcast_history` table. |
| `server/src/services/logger-channel.ts` | Create | Service for dispatching formatted logs to merchant channel with ID masking. |
| `server/src/services/broadcast.ts` | Create | Rate-limited bulk broadcasting engine with Price Drop templates. |
| `server/src/routes/merchant.routes.ts` | Modify | REST API endpoints for broadcast dispatch, history, and test logs. |
| `server/src/services/inventory.ts` | Modify | Trigger `dispatchPurchaseLog` on successful order completion. |
| `server/src/services/binance.ts` | Modify | Trigger `dispatchDepositLog` on verified deposit. |
| `server/src/routes/zinipay.routes.ts` | Modify | Trigger `dispatchDepositLog` on confirmed payment. |
| `client/src/components/admin/broadcast/BroadcastView.tsx` | Create | Frontend broadcast view with phone preview, template selector, and history. |
| `client/src/pages/admin/Dashboard.tsx` | Modify | Integrate Broadcast tab and Log Channel settings card. |
