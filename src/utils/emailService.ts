// WIP file for the email service
import nodemailer from 'nodemailer';
import { PDFDocument } from 'pdf-lib';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  }
}

interface EmailAttachment {
  filename: string;
  content: Buffer;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

// Email service class
class EmailService {
  private transporter: nodemailer.Transporter;
  private static instance: EmailService;

  private constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport(config);
  }

  // get the instance of the email service
  public static getInstance(config?: EmailConfig): EmailService {
    if (!EmailService.instance && config) {
      EmailService.instance = new EmailService(config);
    }
    return EmailService.instance;
  }

  // send an email
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.VITE_EMAIL_FROM,
        ...options
      });
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // send a pdf email
  public async sendPdfEmail(
    to: string,
    subject: string,
    pdfBuffer: Buffer,
    filename: string,
    message?: string
  ): Promise<boolean> {
    const emailOptions: EmailOptions = {
      to,
      subject,
      text: message,
      attachments: [{
        filename,
        content: pdfBuffer
      }]
    };

    return this.sendEmail(emailOptions);
  }

  // Helper method to convert PDF document to buffer
  public static async pdfToBuffer(pdfDoc: PDFDocument): Promise<Buffer> {
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

// Example usage:
// const emailService = EmailService.getInstance({
//   host: process.env.VITE_EMAIL_HOST!,
//   port: parseInt(process.env.VITE_EMAIL_PORT!),
//   secure: process.env.VITE_EMAIL_SECURE === 'true',
//   auth: {
//     user: process.env.VITE_EMAIL_USER!,
//     pass: process.env.VITE_EMAIL_PASSWORD!
//   }
// });

export default EmailService;
