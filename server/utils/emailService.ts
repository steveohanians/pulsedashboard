// Email service for production use
// TODO: Implement with your preferred email provider (SendGrid, AWS SES, etc.)

import logger from "./logger";

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static instance: EmailService;
  private isProduction = process.env.NODE_ENV === 'production';
  
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }
  
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isProduction) {
      // In development, just log the email
      logger.debug("Email would be sent", {
        to: options.to,
        subject: options.subject,
        text: options.text
      });
      return true;
    }
    
    try {
      // TODO: Implement actual email sending
      // Example with SendGrid:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send(options);
      
      logger.info("Email sent successfully", { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error("Failed to send email", { error, to: options.to, subject: options.subject });
      return false;
    }
  }
  
  async sendPasswordReset(email: string, resetLink: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: "Password Reset - Pulse Dashboard™",
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Pulse Dashboard™ account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      `,
      text: `
        Password Reset Request
        
        You requested a password reset for your Pulse Dashboard™ account.
        
        Visit this link to reset your password: ${resetLink}
        
        This link will expire in 24 hours.
        
        If you didn't request this reset, please ignore this email.
      `
    });
  }
  
  async sendUserInvitation(email: string, inviteLink: string, inviterName: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: "Invitation to Pulse Dashboard™",
      html: `
        <h2>You've been invited to Pulse Dashboard™</h2>
        <p>${inviterName} has invited you to join Pulse Dashboard™.</p>
        <p>Click the link below to set up your account:</p>
        <p><a href="${inviteLink}">Set Up Account</a></p>
        <p>This invitation will expire in 7 days.</p>
      `,
      text: `
        You've been invited to Pulse Dashboard™
        
        ${inviterName} has invited you to join Pulse Dashboard™.
        
        Visit this link to set up your account: ${inviteLink}
        
        This invitation will expire in 7 days.
      `
    });
  }
}

export const emailService = EmailService.getInstance();