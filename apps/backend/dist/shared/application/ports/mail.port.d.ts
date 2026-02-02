export interface IMailService {
    sendEmail(to: string, subject: string, html: string): Promise<boolean>;
    sendWelcomeEmail(to: string, ownerName: string, setupUrl: string): Promise<boolean>;
}
//# sourceMappingURL=mail.port.d.ts.map