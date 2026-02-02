import nodemailer from "nodemailer";
import { appConfig } from "../../../config/app.config";
import { MailTemplates } from "./mail.templates";
export class MailService {
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
    async sendEmail(to, subject, html) {
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
        }
        catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error);
            return false;
        }
    }
    async sendWelcomeEmail(to, ownerName, setupUrl) {
        const html = MailTemplates.getWelcomeEmail({
            ownerName,
            organizationName: "Your Organization", // TODO: Pass Org Name
            email: to,
            setupUrl,
        });
        return this.sendEmail(to, "Welcome to Banijjik - Setup Your Account", html);
    }
}
//# sourceMappingURL=mail.service.js.map