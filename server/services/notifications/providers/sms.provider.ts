import { logger } from '../../../utils/logger.js';
import { SmsProviderConfigDTO } from '../../../../shared/types/index.js';

export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  provider: string;
  recipient: string;
  segmentCount: number;
  statusCode?: number | string;
  error?: string;
  simulated: boolean;
  deliveredAt: string;
}

/**
 * Standard interface for all SMS provider adapters (NextSMS, Beem SMS, Twilio, etc.)
 */
export interface SmsProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult>;
}

// ----------------------------------------------------------------------------
// 1. Tanzania NextSMS Provider Adapter
// ----------------------------------------------------------------------------
export class NextSmsProvider implements SmsProvider {
  id = 'NEXT_SMS';
  name = 'NextSMS Tanzania Gateway';
  private config: SmsProviderConfigDTO;

  constructor(config: SmsProviderConfigDTO) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiSecret && !this.config.sandboxMode);
  }

  async sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult> {
    const from = senderId || this.config.senderId || 'NEXA-LMS';
    const segmentCount = Math.ceil(message.length / 160) || 1;

    if (!this.isConfigured()) {
      logger.info(`[SMS SIMULATION - NextSMS] To: ${recipientPhone} | From: ${from} | Text: "${message}"`);
      return {
        success: true,
        messageId: `sim-nextsms-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        simulated: true,
        deliveredAt: new Date().toISOString(),
      };
    }

    try {
      const endpoint = this.config.endpointUrl || 'https://messaging-service.co.tz/api/sms/v1/text/single';
      const authToken = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: recipientPhone.replace(/[^0-9+]/g, ''),
          text: message,
        }),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`NextSMS API error HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }

      return {
        success: true,
        messageId: (responseData as any).messages?.[0]?.messageId || `nextsms-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        statusCode: response.status,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[NextSMS Error] Failed to send SMS to ${recipientPhone}:`, error);
      return {
        success: false,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        error: (error as Error).message,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 2. Tanzania Beem SMS Provider Adapter
// ----------------------------------------------------------------------------
export class BeemSmsProvider implements SmsProvider {
  id = 'BEEM_SMS';
  name = 'Beem Africa SMS Gateway (Tanzania)';
  private config: SmsProviderConfigDTO;

  constructor(config: SmsProviderConfigDTO) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiSecret && !this.config.sandboxMode);
  }

  async sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult> {
    const source_addr = senderId || this.config.senderId || 'INFO';
    const segmentCount = Math.ceil(message.length / 160) || 1;

    if (!this.isConfigured()) {
      logger.info(`[SMS SIMULATION - Beem Africa] To: ${recipientPhone} | From: ${source_addr} | Text: "${message}"`);
      return {
        success: true,
        messageId: `sim-beem-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        simulated: true,
        deliveredAt: new Date().toISOString(),
      };
    }

    try {
      const endpoint = this.config.endpointUrl || 'https://apisms.beem.africa/v1/send';
      const authToken = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_addr,
          schedule_time: '',
          encoding: '0',
          message,
          recipients: [{ recipient_id: 1, dest_addr: recipientPhone.replace(/[^0-9]/g, '') }],
        }),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Beem API error HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }

      return {
        success: true,
        messageId: (responseData as any).data?.request_id || `beem-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        statusCode: response.status,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[Beem SMS Error] Failed to send SMS to ${recipientPhone}:`, error);
      return {
        success: false,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        error: (error as Error).message,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 3. Twilio SMS Provider Adapter
// ----------------------------------------------------------------------------
export class TwilioSmsProvider implements SmsProvider {
  id = 'TWILIO';
  name = 'Twilio SMS Gateway';
  private config: SmsProviderConfigDTO;

  constructor(config: SmsProviderConfigDTO) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiSecret && !this.config.sandboxMode);
  }

  async sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult> {
    const from = senderId || this.config.senderId || '+15005550006';
    const segmentCount = Math.ceil(message.length / 160) || 1;

    if (!this.isConfigured()) {
      logger.info(`[SMS SIMULATION - Twilio] To: ${recipientPhone} | From: ${from} | Text: "${message}"`);
      return {
        success: true,
        messageId: `sim-twilio-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        simulated: true,
        deliveredAt: new Date().toISOString(),
      };
    }

    try {
      const accountSid = this.config.apiKey;
      const authToken = this.config.apiSecret;
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const params = new URLSearchParams();
      params.append('To', recipientPhone);
      params.append('From', from);
      params.append('Body', message);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Twilio API error HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }

      return {
        success: true,
        messageId: (responseData as any).sid || `twilio-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        statusCode: response.status,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[Twilio SMS Error] Failed to send SMS to ${recipientPhone}:`, error);
      return {
        success: false,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        error: (error as Error).message,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 4. Generic Webhook SMS Provider Adapter
// ----------------------------------------------------------------------------
export class GenericWebhookSmsProvider implements SmsProvider {
  id = 'GENERIC_WEBHOOK';
  name = 'Custom Webhook Gateway';
  private config: SmsProviderConfigDTO;

  constructor(config: SmsProviderConfigDTO) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.endpointUrl && !this.config.sandboxMode);
  }

  async sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult> {
    const from = senderId || this.config.senderId || 'NEXA';
    const segmentCount = Math.ceil(message.length / 160) || 1;

    if (!this.isConfigured()) {
      logger.info(`[SMS SIMULATION - Generic Webhook] To: ${recipientPhone} | From: ${from} | Text: "${message}"`);
      return {
        success: true,
        messageId: `sim-webhook-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        simulated: true,
        deliveredAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(this.config.endpointUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          to: recipientPhone,
          from,
          message,
          timestamp: new Date().toISOString(),
        }),
      });

      return {
        success: response.ok,
        messageId: `webhook-${Date.now()}`,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        statusCode: response.status,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        recipient: recipientPhone,
        segmentCount,
        error: (error as Error).message,
        simulated: false,
        deliveredAt: new Date().toISOString(),
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 5. Sandbox / Simulation SMS Provider Adapter
// ----------------------------------------------------------------------------
export class SandboxSmsProvider implements SmsProvider {
  id = 'SANDBOX';
  name = 'Simulated Sandbox Provider (Safe Mode)';
  private config: SmsProviderConfigDTO;

  constructor(config: SmsProviderConfigDTO) {
    this.config = config;
  }

  isConfigured(): boolean {
    return true; // Always available and safe
  }

  async sendSms(recipientPhone: string, message: string, senderId?: string): Promise<SmsDeliveryResult> {
    const from = senderId || this.config.senderId || 'NEXA-BANK';
    const segmentCount = Math.ceil(message.length / 160) || 1;

    logger.info(`[SMS SANDBOX AUDIT] To: ${recipientPhone} | Sender: ${from} | Segments: ${segmentCount} | Body: "${message}"`);

    return {
      success: true,
      messageId: `sandbox-sms-${Date.now()}`,
      provider: this.name,
      recipient: recipientPhone,
      segmentCount,
      simulated: true,
      deliveredAt: new Date().toISOString(),
    };
  }
}

/**
 * Factory function to retrieve the configured SMS provider
 */
export function getSmsProvider(config: SmsProviderConfigDTO): SmsProvider {
  switch (config.providerId) {
    case 'NEXT_SMS':
      return new NextSmsProvider(config);
    case 'BEEM_SMS':
      return new BeemSmsProvider(config);
    case 'TWILIO':
      return new TwilioSmsProvider(config);
    case 'GENERIC_WEBHOOK':
      return new GenericWebhookSmsProvider(config);
    case 'SANDBOX':
    default:
      return new SandboxSmsProvider(config);
  }
}
