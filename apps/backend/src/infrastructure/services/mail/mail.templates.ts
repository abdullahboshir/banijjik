export const MailTemplates = {
  getWelcomeEmail: (data: {
    ownerName: string;
    organizationName: string;
    email: string;
    setupUrl: string;
  }) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              .container { font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a202c; }
              .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { border: 1px solid #e2e8f0; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; line-height: 1.6; }
              .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #718096; }
              .info-box { background: #f8fafc; border: 1px dashed #cbd5e0; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Setup Your Account</h1>
              </div>
              <div class="content">
                  <p>As-salamu alaykum <strong>${data.ownerName}</strong>,</p>
                  <p>Congratulations! Your organization, <strong>${data.organizationName}</strong>, has been successfully registered on the <strong>Banijjik Platform</strong>.</p>
                  
                  <p>To access your dashboard, you first need to set up your password. Please use the button below to initialize your account:</p>
                  
                  <div class="info-box">
                      <p><strong>Registered Email:</strong> ${data.email}</p>
                  </div>

                  <a href="${data.setupUrl}" class="btn">Setup My Password</a>

                  <p style="margin-top: 30px;">This link will expire in 72 hours. If you did not request this, please ignore this email.</p>
                  
                  <p>Best Regards,<br><strong>Banijjik Team</strong></p>
              </div>
              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Banijjik. All rights reserved.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  },
};
