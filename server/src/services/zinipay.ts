import axios from 'axios';

const ZINIPAY_BASE_URL = 'https://api.zinipay.com';

export interface CreateZinipayInvoiceParams {
  apiKey: string;
  amountBdt: number;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
  redirectUrl: string;
  cancelUrl?: string;
  webhookUrl?: string;
}

export interface ZinipayCreateResponse {
  status: boolean;
  message?: string;
  payment_url?: string;
  invoice_id?: string;
  data?: {
    payment_url?: string;
    invoice_id?: string;
    [key: string]: any;
  };
}

export interface ZinipayVerifyResponse {
  status: string; // 'COMPLETED', 'PENDING', 'FAILED', or boolean in some payloads
  amount?: number;
  transaction_id?: string;
  invoice_id?: string;
  payment_method?: string;
  customer_name?: string;
  customer_email?: string;
  metadata?: any;
  message?: string;
  data?: any;
  [key: string]: any;
}

/**
 * Create a hosted checkout invoice via ZiniPay API
 * POST /v1/payment/create
 */
export async function createZinipayInvoice(params: CreateZinipayInvoiceParams): Promise<{
  success: boolean;
  paymentUrl?: string;
  invoiceId?: string;
  error?: string;
}> {
  try {
    const payload: Record<string, any> = {
      amount: Number(params.amountBdt),
      redirect_url: params.redirectUrl,
    };

    if (params.customerName) payload.cus_name = params.customerName;
    if (params.customerEmail) payload.cus_email = params.customerEmail;
    if (params.metadata) payload.metadata = params.metadata;
    if (params.cancelUrl) payload.cancel_url = params.cancelUrl;
    if (params.webhookUrl) payload.webhook_url = params.webhookUrl;

    const response = await axios.post<ZinipayCreateResponse>(
      `${ZINIPAY_BASE_URL}/v1/payment/create`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': params.apiKey.trim(),
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const paymentUrl = data.payment_url || data.data?.payment_url;
    const invoiceId = data.invoice_id || data.data?.invoice_id || extractInvoiceIdFromUrl(paymentUrl);

    if (paymentUrl) {
      return {
        success: true,
        paymentUrl,
        invoiceId,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to generate ZiniPay checkout link',
    };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('[ZiniPay Service] Invoice creation failed:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Verify an invoice status via ZiniPay API
 * POST /v1/payment/verify
 */
export async function verifyZinipayInvoice(apiKey: string, invoiceId: string): Promise<{
  success: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  amount?: number;
  transactionId?: string;
  paymentMethod?: string;
  metadata?: any;
  error?: string;
}> {
  try {
    const response = await axios.post<ZinipayVerifyResponse>(
      `${ZINIPAY_BASE_URL}/v1/payment/verify`,
      { invoice_id: invoiceId },
      {
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': apiKey.trim(),
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const rawStatus = (data.status || data.data?.status || '').toString().toUpperCase();

    let normalizedStatus: 'COMPLETED' | 'PENDING' | 'FAILED' = 'PENDING';
    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS' || rawStatus === 'TRUE' || data.status === 'COMPLETED') {
      normalizedStatus = 'COMPLETED';
    } else if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED' || rawStatus === 'EXPIRED') {
      normalizedStatus = 'FAILED';
    }

    const transactionId = data.transaction_id || data.data?.transaction_id || data.trx_id;
    const amount = Number(data.amount || data.data?.amount || 0);
    const paymentMethod = data.payment_method || data.data?.payment_method || 'ZiniPay';
    const metadata = data.metadata || data.data?.metadata;

    return {
      success: true,
      status: normalizedStatus,
      amount,
      transactionId,
      paymentMethod,
      metadata,
    };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('[ZiniPay Service] Verification failed:', errorMsg);
    return {
      success: false,
      status: 'FAILED',
      error: errorMsg,
    };
  }
}

function extractInvoiceIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parts = url.split('/');
    return parts[parts.length - 1];
  } catch {
    return undefined;
  }
}
