import axios from 'axios';
import crypto from 'crypto';
import { db } from '../db/database';
import { decrypt } from './crypto';

const BINANCE_API_BASE = 'https://api.binance.com';

export interface BinanceVerifyResult {
  success: boolean;
  amountUsd?: number;
  payerId?: string;
  trxId?: string;
  error?: string;
}

export function generateBinanceSignature(queryString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

/**
 * Verify a Binance Pay transaction using HMAC SHA256 SAPI
 */
export async function verifyBinancePayTransaction(params: {
  apiKey: string;
  apiSecret: string;
  expectedReceiverUid: string;
  trxId: string;
  expectedAmountUsd?: number; // optional tolerance check
}): Promise<BinanceVerifyResult> {
  const { apiKey, apiSecret, expectedReceiverUid, trxId, expectedAmountUsd } = params;

  if (!apiKey || !apiSecret) {
    return { success: false, error: 'Binance API credentials missing' };
  }

  // 1. Check Replay Attack in global verified table
  const existingTrx = db.prepare('SELECT id FROM crypto_verified_transactions WHERE trx_id = ?').get(trxId);
  if (existingTrx) {
    return { success: false, error: 'This transaction ID has already been redeemed and verified.' };
  }

  const timestamp = Date.now();
  // Query past 48 hours to now
  const startTimestamp = timestamp - 48 * 60 * 60 * 1000;
  const queryString = `startTimestamp=${startTimestamp}&endTimestamp=${timestamp}&timestamp=${timestamp}`;
  const signature = generateBinanceSignature(queryString, apiSecret);

  try {
    const res = await axios.get(`${BINANCE_API_BASE}/sapi/v1/pay/transactions?${queryString}&signature=${signature}`, {
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
      timeout: 10000,
    });

    if (res.data?.code !== '000000' && res.data?.status !== 'SUCCESS' && !Array.isArray(res.data?.data)) {
      return { success: false, error: res.data?.errorMessage || 'Binance query returned unsuccessful status' };
    }

    const txList = res.data.data;
    if (!Array.isArray(txList)) {
      return { success: false, error: 'No transaction history found on Binance' };
    }

    // Find the specific transaction by transactionId or orderId
    const matchedTx = txList.find((tx: any) => {
      const idMatch = String(tx.transactionId) === trxId || String(tx.orderId) === trxId;
      return idMatch;
    });

    if (!matchedTx) {
      return { success: false, error: 'Transaction ID not found in the last 48 hours for this Binance account.' };
    }

    // 2. Validate transaction status
    // Note: Items returned by Binance /sapi/v1/pay/transactions are historical completed transactions.
    // If status or orderStatus is present, verify it is not failed/cancelled.
    if (matchedTx.status && matchedTx.status !== 'SUCCESS') {
      return { success: false, error: `Transaction is not completed (Current status: ${matchedTx.status})` };
    }
    if (matchedTx.orderStatus && matchedTx.orderStatus !== 'SUCCESS') {
      return { success: false, error: `Transaction is not completed (Current status: ${matchedTx.orderStatus})` };
    }

    // 3. Validate currency
    const currency = matchedTx.currency || matchedTx.fundsDetail?.[0]?.currency;
    if (currency && currency.toUpperCase() !== 'USDT') {
      return { success: false, error: `Invalid currency: ${currency}. Only USDT deposits are accepted.` };
    }

    const rawAmount = matchedTx.amount || matchedTx.fundsDetail?.[0]?.amount || 0;
    const actualAmount = Math.abs(parseFloat(String(rawAmount)));

    if (isNaN(actualAmount) || actualAmount <= 0) {
      return { success: false, error: 'Could not determine valid transaction amount from Binance' };
    }

    // 4. Validate amount if expected amount is provided
    if (expectedAmountUsd && Math.abs(actualAmount - expectedAmountUsd) > 0.05) {
      return {
        success: false,
        error: `Amount mismatch: Expected $${expectedAmountUsd.toFixed(2)} USDT, but transaction is $${actualAmount.toFixed(2)} USDT`,
      };
    }

    return {
      success: true,
      amountUsd: actualAmount,
      payerId: String(matchedTx.payerInfo?.binanceId || matchedTx.payerInfo?.name || matchedTx.payerId || ''),
      trxId: String(matchedTx.transactionId || matchedTx.orderId),
    };
  } catch (err: any) {
    console.error('Binance Pay SAPI error:', err.response?.data || err.message);
    const msg = err.response?.data?.msg || err.response?.data?.errorMessage || err.message;
    return { success: false, error: `Binance API error: ${msg}` };
  }
}

/**
 * Tier 2: Merchant wholesale wallet top-up to Platform Owner
 */
export async function verifyMerchantWholesaleTopup(params: {
  tenantId: string;
  trxId: string;
  declaredAmountUsd: number;
}): Promise<BinanceVerifyResult> {
  const { tenantId, trxId, declaredAmountUsd } = params;

  // Read Owner's Binance Config from Global System Config
  const config = db.prepare('SELECT * FROM global_system_config WHERE id = 1').get() as any;
  if (!config) {
    return { success: false, error: 'Platform Binance Pay configuration not found' };
  }

  const apiKey = decrypt(config.owner_binance_api_key_enc);
  const apiSecret = decrypt(config.owner_binance_api_secret_enc);
  const ownerUid = config.owner_binance_uid;

  if (!apiKey || !apiSecret || !ownerUid) {
    return { success: false, error: 'Platform Owner has not configured Binance Pay credentials in God-Mode yet.' };
  }

  const result = await verifyBinancePayTransaction({
    apiKey,
    apiSecret,
    expectedReceiverUid: ownerUid,
    trxId,
    expectedAmountUsd: declaredAmountUsd,
  });

  if (!result.success || !result.amountUsd) {
    return result;
  }

  // Atomic ledger commit: Credit merchant wallet and register verified tx
  const topupTx = db.transaction(() => {
    // 1. Record in crypto_verified_transactions
    db.prepare(`
      INSERT INTO crypto_verified_transactions (trx_id, payer_id, receiver_uid, amount_usd, purpose, tenant_id)
      VALUES (?, ?, ?, ?, 'wholesale_topup', ?)
    `).run(trxId, result.payerId || '', ownerUid, result.amountUsd, tenantId);

    // 2. Increment merchant wallet_usd
    db.prepare(`
      UPDATE tenants SET wallet_usd = wallet_usd + ? WHERE id = ?
    `).run(result.amountUsd, tenantId);
  });

  topupTx();
  return result;
}

/**
 * Tier 1: End-buyer deposit to Merchant's own Binance Pay UID
 */
export async function verifyCustomerRetailBinanceDeposit(params: {
  tenantId: string;
  customerTelegramId: number;
  trxId: string;
  amountUsd: number;
}): Promise<BinanceVerifyResult> {
  const { tenantId, customerTelegramId, trxId, amountUsd } = params;

  const tenant = db.prepare('SELECT binance_config_json_enc FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) {
    return { success: false, error: 'Store not found' };
  }

  const decryptedConfig = decrypt(tenant.binance_config_json_enc);
  let config: { uid?: string; apiKey?: string; apiSecret?: string } = {};
  try {
    config = JSON.parse(decryptedConfig || '{}');
  } catch (e) {
    return { success: false, error: 'Invalid merchant Binance configuration' };
  }

  if (!config.apiKey || !config.apiSecret || !config.uid) {
    return { success: false, error: 'This merchant has not enabled automated Binance Pay yet.' };
  }

  const result = await verifyBinancePayTransaction({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    expectedReceiverUid: config.uid,
    trxId,
    expectedAmountUsd: amountUsd,
  });

  if (!result.success || !result.amountUsd) {
    return result;
  }

  // Atomic deposit approval & customer balance credit
  const depositTx = db.transaction(() => {
    // 1. Record verified crypto tx
    db.prepare(`
      INSERT INTO crypto_verified_transactions (trx_id, payer_id, receiver_uid, amount_usd, purpose, tenant_id)
      VALUES (?, ?, ?, ?, 'retail_deposit', ?)
    `).run(trxId, result.payerId || '', config.uid!, result.amountUsd, tenantId);

    // 2. Insert into deposits table as APPROVED
    db.prepare(`
      INSERT INTO deposits (
        tenant_id, customer_telegram_id, method, amount_bdt, amount_usd, trx_id, status, processed_at
      ) VALUES (?, ?, 'Binance', 0, ?, ?, 'APPROVED', CURRENT_TIMESTAMP)
    `).run(tenantId, customerTelegramId, result.amountUsd, trxId);

    // 3. Credit customer's balance_usd
    db.prepare(`
      UPDATE customers SET balance_usd = balance_usd + ? WHERE tenant_id = ? AND telegram_id = ?
    `).run(result.amountUsd, tenantId, customerTelegramId);
  });

  depositTx();
  return result;
}
