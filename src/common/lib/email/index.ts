import nodemailer, { Transporter } from 'nodemailer';
import { CONSTANTS } from '@/common/configuration/constants';
import logger from '@/common/lib/logger';

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: CONSTANTS.SMTP_USER,
        pass: CONSTANTS.SMTP_PASS,
      },
    });
  }

  async sendHtml(to: string, subject: string, html: string): Promise<void> {
    if (!CONSTANTS.SMTP_USER || !CONSTANTS.SMTP_PASS) {
      logger.warn(`Email skipped (SMTP not configured): to=${to} subject="${subject}"`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"BillBot" <${CONSTANTS.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      logger.info(`Email sent: to=${to} subject="${subject}"`);
    } catch (error) {
      logger.error(`Email delivery failed: to=${to} error=${error}`);
      // Do not re-throw — a failed email should never break the caller's flow
    }
  }
}

// Singleton — one transporter for the process lifetime
const emailService = new EmailService();
export default emailService;
