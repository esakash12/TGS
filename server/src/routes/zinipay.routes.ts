import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { decrypt } from '../services/crypto';
import { verifyZinipayInvoice } from '../services/zinipay';
import { botRegistry } from '../../../bot/src/registry';

export const zinipayRouter = Router();

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

    // 1. Locate the pending deposit with this invoice_id in trx_id
    const deposit = db.prepare(`
      SELECT * FROM deposits WHERE trx_id = ? AND method = 'ZiniPay'
    `).get(String(invoiceId).trim()) as any;

    if (!deposit) {
      console.warn(`[ZiniPay Webhook] No matching ZiniPay deposit found for invoice: ${invoiceId}`);
      // Return 200 so ZiniPay does not retry indefinitely if unknown
      return res.status(200).json({ received: true, note: 'Deposit not found' });
    }

    // If already approved, return early to prevent double-crediting
    if (deposit.status === 'APPROVED') {
      return res.status(200).json({ received: true, note: 'Already processed' });
    }

    // 2. Fetch tenant to get decrypted API Key
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(deposit.tenant_id) as any;
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const apiKey = decrypt(tenant.zinipay_api_key_enc);
    if (!apiKey) {
      console.error(`[ZiniPay Webhook] Tenant ${tenant.id} has no valid ZiniPay API key configured`);
      return res.status(400).json({ error: 'Merchant ZiniPay API key missing' });
    }

    // 3. Re-verify the invoice with ZiniPay upstream API for tamper-proof security
    const verifyResult = await verifyZinipayInvoice(apiKey, String(invoiceId).trim());
    if (!verifyResult.success || verifyResult.status !== 'COMPLETED') {
      console.warn(`[ZiniPay Webhook] Verification returned status: ${verifyResult.status}`);
      return res.status(200).json({ received: true, status: verifyResult.status });
    }

    // 4. Atomic credit in SQLite
    const actualTrxId = verifyResult.transactionId || invoiceId;
    const finalAmountUsd = Number(deposit.amount_usd);

    const approveTx = db.transaction(() => {
      // Mark deposit APPROVED and update trx_id to actual gateway transaction ID if available
      db.prepare(`
        UPDATE deposits 
        SET status = 'APPROVED',
            admin_note = ?,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'PENDING'
      `).run(`Auto-credited via ZiniPay (${verifyResult.paymentMethod || 'Mobile Banking'}). Gateway TrxID: ${actualTrxId}`, deposit.id);

      // Increment customer wallet balance
      db.prepare(`
        UPDATE customers 
        SET balance_usd = balance_usd + ?
        WHERE tenant_id = ? AND telegram_id = ?
      `).run(finalAmountUsd, deposit.tenant_id, deposit.customer_telegram_id);
    });

    approveTx();

    console.log(`[ZiniPay Webhook] Successfully credited $${finalAmountUsd.toFixed(2)} USD to customer ${deposit.customer_telegram_id} for tenant ${tenant.id}`);

    // 5. Send instant confirmation to customer on Telegram
    const notifyMsg =
      `🎉 <b>ZiniPay Instant Deposit Approved!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💳 Method: <b>${verifyResult.paymentMethod || 'bKash/Nagad/Rocket (ZiniPay)'}</b>\n` +
      `💵 Credited: <b>$${finalAmountUsd.toFixed(2)} USD</b> (${deposit.amount_bdt} BDT)\n` +
      `🧾 Invoice ID: <code>${invoiceId}</code>\n` +
      (actualTrxId !== invoiceId ? `🧾 TrxID: <code>${actualTrxId}</code>\n` : '') +
      `⚡ Status: <b>APPROVED (Instant)</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<i>Your wallet balance has been updated. Tap /start to shop!</i>`;

    botRegistry.sendNotificationToCustomer(
      deposit.tenant_id,
      deposit.customer_telegram_id,
      notifyMsg
    );

    // 6. Notify store admin if configured
    if (tenant.admin_telegram_id) {
      const adminMsg =
        `⚡ <b>ZiniPay Automated Payment Received!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 Customer ID: <code>${deposit.customer_telegram_id}</code>\n` +
        `💵 Amount: <b>$${finalAmountUsd.toFixed(2)} USD (${deposit.amount_bdt} BDT)</b>\n` +
        `💳 Gateway: <b>${verifyResult.paymentMethod || 'ZiniPay Checkout'}</b>\n` +
        `🧾 Invoice: <code>${invoiceId}</code>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<i>Customer was automatically credited.</i>`;

      botRegistry.sendNotificationToCustomer(
        deposit.tenant_id,
        tenant.admin_telegram_id,
        adminMsg
      );
    }

    return res.status(200).json({ status: true, message: 'Deposit completed successfully' });
  } catch (err: any) {
    console.error('[ZiniPay Webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Customer Redirect / Callback Page
 * GET /api/zinipay/callback?invoice_id=...
 */
zinipayRouter.get('/callback', async (req: Request, res: Response) => {
  const invoiceId = req.query.invoice_id as string;
  if (!invoiceId) {
    return res.send('<h2>Invalid Payment Callback</h2><p>No invoice_id specified.</p>');
  }

  const deposit = db.prepare('SELECT * FROM deposits WHERE trx_id = ?').get(invoiceId) as any;
  let botUsername = '';
  if (deposit) {
    const tenant = db.prepare('SELECT bot_username FROM tenants WHERE id = ?').get(deposit.tenant_id) as any;
    botUsername = tenant?.bot_username || '';
  }

  const botRedirectUrl = botUsername ? `https://t.me/${botUsername}` : '#';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Successful - Mogent</title>
      <style>
        body {
          background-color: #0d0f12;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .card {
          background: #181b20;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 32px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .icon {
          width: 64px;
          height: 64px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #10b981;
          font-size: 32px;
          margin-bottom: 16px;
        }
        h2 { margin: 0 0 8px; font-size: 22px; color: #fff; }
        p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
        .invoice-box {
          background: #0f1115;
          padding: 12px;
          border-radius: 12px;
          font-family: monospace;
          color: #38bdf8;
          font-size: 13px;
          margin-bottom: 24px;
          word-break: break-all;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          color: #fff;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          padding: 14px 28px;
          border-radius: 14px;
          transition: transform 0.1s ease;
        }
        .btn:active { transform: scale(0.98); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✓</div>
        <h2>Payment Processed!</h2>
        <p>Your payment via ZiniPay has been submitted. Your bot balance is credited automatically.</p>
        <div class="invoice-box">Invoice: ${invoiceId}</div>
        ${botUsername ? `<a class="btn" href="${botRedirectUrl}">Return to Telegram Bot</a>` : '<p style="color:#71717a">You can now close this tab and return to Telegram.</p>'}
      </div>
    </body>
    </html>
  `);
});
