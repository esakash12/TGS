import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { decrypt } from '../services/crypto';
import { verifyZinipayInvoice } from '../services/zinipay';
import { botRegistry } from '../../../bot/src/registry';
import { dispatchDepositLog } from '../services/logger-channel';

export const zinipayRouter = Router();

/**
 * Universal Processor: verifies and approves a ZiniPay invoice safely.
 * Called by:
 * 1. Webhook (POST /api/zinipay/webhook)
 * 2. Callback redirect (GET /api/zinipay/callback)
 * 3. Background periodic poller in server/src/index.ts
 */
export async function approveZinipayInvoice(invoiceId: string): Promise<{
  success: boolean;
  status: 'APPROVED' | 'ALREADY_APPROVED' | 'PENDING' | 'FAILED' | 'NOT_FOUND';
  deposit?: any;
  message?: string;
}> {
  const cleanInvoiceId = String(invoiceId || '').trim();
  if (!cleanInvoiceId) {
    return { success: false, status: 'NOT_FOUND', message: 'Invoice ID empty' };
  }

  // 1. Locate the deposit with this invoice_id in trx_id
  const deposit = db.prepare(`
    SELECT * FROM deposits WHERE trx_id = ? AND method = 'ZiniPay'
  `).get(cleanInvoiceId) as any;

  if (!deposit) {
    return { success: false, status: 'NOT_FOUND', message: 'Deposit not found' };
  }

  // If already approved, exit cleanly without double crediting
  if (deposit.status === 'APPROVED') {
    return { success: true, status: 'ALREADY_APPROVED', deposit };
  }

  // 2. Fetch tenant to get decrypted API Key
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(deposit.tenant_id) as any;
  if (!tenant) {
    return { success: false, status: 'FAILED', message: 'Tenant not found' };
  }

  const apiKey = decrypt(tenant.zinipay_api_key_enc);
  if (!apiKey) {
    console.error(`[ZiniPay] Tenant ${tenant.id} has no valid ZiniPay API key configured`);
    return { success: false, status: 'FAILED', message: 'Merchant ZiniPay API key missing' };
  }

  // 3. Re-verify the invoice with ZiniPay upstream API
  const verifyResult = await verifyZinipayInvoice(apiKey, cleanInvoiceId);
  if (!verifyResult.success || verifyResult.status !== 'COMPLETED') {
    return {
      success: false,
      status: verifyResult.status === 'FAILED' ? 'FAILED' : 'PENDING',
      message: `Verification status is ${verifyResult.status}`,
    };
  }

  // 4. Atomic credit in SQLite
  const actualTrxId = verifyResult.transactionId || cleanInvoiceId;
  const finalAmountUsd = Number(deposit.amount_usd);

  let creditCommitted = false;
  const approveTx = db.transaction(() => {
    // Check again inside transaction to prevent race conditions
    const current = db.prepare('SELECT status FROM deposits WHERE id = ?').get(deposit.id) as any;
    if (current && current.status === 'APPROVED') {
      return;
    }

    // Mark deposit APPROVED and update note
    db.prepare(`
      UPDATE deposits 
      SET status = 'APPROVED',
          admin_note = ?,
          processed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'PENDING'
    `).run(
      `Auto-credited via ZiniPay (${verifyResult.paymentMethod || 'Mobile Banking'}). Gateway TrxID: ${actualTrxId}`,
      deposit.id
    );

    // Increment customer wallet balance
    db.prepare(`
      UPDATE customers 
      SET balance_usd = balance_usd + ?
      WHERE tenant_id = ? AND telegram_id = ?
    `).run(finalAmountUsd, deposit.tenant_id, deposit.customer_telegram_id);

    creditCommitted = true;
  });

  approveTx();

  if (!creditCommitted) {
    return { success: true, status: 'ALREADY_APPROVED', deposit };
  }

  console.log(`[ZiniPay] Successfully auto-credited $${finalAmountUsd.toFixed(2)} USD to customer ${deposit.customer_telegram_id} for tenant ${tenant.id}`);

  // 5. Send instant confirmation to customer on Telegram
  const notifyMsg =
    `🎉 <b>ZiniPay Instant Deposit Approved!</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💳 Method: <b>${verifyResult.paymentMethod || 'bKash/Nagad/Rocket (ZiniPay)'}</b>\n` +
    `💵 Credited: <b>$${finalAmountUsd.toFixed(2)} USD</b> (${deposit.amount_bdt} BDT)\n` +
    `🧾 Invoice ID: <code>${cleanInvoiceId}</code>\n` +
    (actualTrxId !== cleanInvoiceId ? `🧾 TrxID: <code>${actualTrxId}</code>\n` : '') +
    `⚡ Status: <b>APPROVED (Instant)</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `<i>Your wallet balance has been updated. Tap /start to shop!</i>`;

  botRegistry.sendNotificationToCustomer(
    deposit.tenant_id,
    deposit.customer_telegram_id,
    notifyMsg
  );

  // Dispatch real-time deposit log to merchant's channel/group
  dispatchDepositLog({
    tenantId: deposit.tenant_id,
    customerTelegramId: deposit.customer_telegram_id,
    amountUsd: finalAmountUsd,
    method: verifyResult.paymentMethod || 'ZiniPay',
    trxId: actualTrxId || cleanInvoiceId,
  }).catch(() => {});

  // 6. Notify store admin if configured
  if (tenant.admin_telegram_id) {
    const adminMsg =
      `⚡ <b>ZiniPay Automated Payment Received!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 Customer ID: <code>${deposit.customer_telegram_id}</code>\n` +
      `💵 Amount: <b>$${finalAmountUsd.toFixed(2)} USD (${deposit.amount_bdt} BDT)</b>\n` +
      `💳 Gateway: <b>${verifyResult.paymentMethod || 'ZiniPay Checkout'}</b>\n` +
      `🧾 Invoice: <code>${cleanInvoiceId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<i>Customer was automatically credited.</i>`;

    botRegistry.sendNotificationToCustomer(
      deposit.tenant_id,
      tenant.admin_telegram_id,
      adminMsg
    );
  }

  return { success: true, status: 'APPROVED', deposit };
}

/**
 * Public Webhook Endpoint for ZiniPay
 * POST /api/zinipay/webhook
 * Receives: { invoice_id: "...", status: "true" | "COMPLETED", ... }
 */
zinipayRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const invoiceId = payload.invoice_id || req.query.invoice_id;

    if (!invoiceId) {
      console.warn('[ZiniPay Webhook] Received webhook with no invoice_id');
      return res.status(400).json({ error: 'invoice_id required' });
    }

    console.log(`[ZiniPay Webhook] Processing invoice_id: ${invoiceId}`);
    const result = await approveZinipayInvoice(String(invoiceId).trim());

    return res.status(200).json({ received: true, ...result });
  } catch (err: any) {
    console.error('[ZiniPay Webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Customer Redirect / Callback Page
 * GET /api/zinipay/callback?invoice_id=...
 * If the user completes payment and returns to or views this URL, we immediately attempt auto-credit.
 */
zinipayRouter.get('/callback', async (req: Request, res: Response) => {
  const invoiceId = (req.query.invoice_id || req.query.id || req.query.invoiceId) as string;

  if (invoiceId) {
    try {
      await approveZinipayInvoice(String(invoiceId).trim());
    } catch (err: any) {
      console.warn(`[ZiniPay Callback] On-demand verify for ${invoiceId} warning:`, err.message);
    }
  }

  let botUsername = '';
  let depositAmountUsd = 0;
  let depositStatus = 'PROCESSED';

  if (invoiceId) {
    const deposit = db.prepare('SELECT * FROM deposits WHERE trx_id = ?').get(String(invoiceId).trim()) as any;
    if (deposit) {
      depositAmountUsd = deposit.amount_usd;
      depositStatus = deposit.status;
      const tenant = db.prepare('SELECT bot_username FROM tenants WHERE id = ?').get(deposit.tenant_id) as any;
      botUsername = tenant?.bot_username || '';
    }
  }

  const isApproved = depositStatus === 'APPROVED';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>${isApproved ? 'Payment Successful' : 'Payment Status'} - Mogent</title>
      <style>
        * { box-sizing: border-box; }
        body {
          background-color: #0b0e14;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .card {
          background: #151921;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 32px 24px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }
        .icon {
          width: 68px;
          height: 68px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          font-size: 34px;
          margin-bottom: 20px;
        }
        h2 { margin: 0 0 10px; font-size: 22px; color: #fff; font-weight: 700; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
        .highlight { color: #38bdf8; font-weight: 600; }
        .badge {
          display: inline-block;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.25);
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
          color: #38bdf8;
          margin-bottom: 20px;
        }
        .dismiss-notice {
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 14px;
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.4;
        }
        .dismiss-notice b { color: #10b981; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✓</div>
        <h2>পেমেন্ট সম্পন্ন হয়েছে!</h2>
        ${depositAmountUsd ? `<div class="badge">+$${Number(depositAmountUsd).toFixed(2)} USD Added</div>` : ''}
        <p>আপনার ব্যালেন্স বটে যুক্ত করা হয়েছে। আপনি এখন এই পপ-আপটি কেটে দিতে পারেন।</p>
        
        <div class="dismiss-notice">
          👉 <b>টেলিগ্রামের উপরে কোণায় '✕' (Close) চাপ দিয়ে কেটে দিন।</b><br>
          আপনার বটে স্বয়ংক্রিয়ভাবে ব্যালেন্স আপডেট হয়ে গেছে!
        </div>
      </div>
    </body>
    </html>
  `);
});
