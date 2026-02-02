import nodemailer from "nodemailer";
import { appConfig } from "../../../config/app.config";
import { IMailService } from "../../../shared/application/ports/mail.port";
import { MailTemplates } from "./mail.templates";

export class MailService implements IMailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: appConfig.smtp_host,
      port: appConfig.smtp_port,
      secure: appConfig.smtp_port === 465,
      auth: {
        user: appConfig.smtp_user,
        pass: appConfig.smtp_pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      console.log(`📧 Sending email to: ${to}`);
      await this.transporter.sendMail({
        from: `"${appConfig.smtp_from_name}" <${appConfig.smtp_from}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendWelcomeEmail(
    to: string,
    ownerName: string,
    setupUrl: string,
  ): Promise<boolean> {
    const html = MailTemplates.getWelcomeEmail({
      ownerName,
      organizationName: "Your Organization", // TODO: Pass Org Name
      email: to,
      setupUrl,
    });
    return this.sendEmail(to, "Welcome to Banijjik - Setup Your Account", html);
  }
}
