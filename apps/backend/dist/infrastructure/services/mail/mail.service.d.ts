import { IMailService } from "../../../shared/application/ports/mail.port";
export declare class MailService implements IMailService {
    private transporter;
    constructor();
    sendEmail(to: string, subject: string, html: string): Promise<boolean>;
    sendWelcomeEmail(to: string, ownerName: string, setupUrl: string): Promise<boolean>;
}
//# sourceMappingURL=mail.service.d.ts.map