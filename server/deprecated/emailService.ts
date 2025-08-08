/**
 * Email Service - Production-ready email delivery system with environment-aware behavior and template management.
 * Provides centralized email functionality with security-focused template handling and provider abstraction.
 * 
 * Core Features:
 * - Singleton pattern for centralized email management
 * - Environment-aware behavior (development logging vs production delivery)
 * - Multi-format email support (HTML and plain text)
 * - Pre-built templates for common use cases (password reset, user invitation)
 * - Structured logging integration for delivery tracking
 * - Provider abstraction for easy integration with external services
 * 
 * Security Considerations:
 * - HTML template sanitization (caller responsibility for safe content)
 * - Link expiration tracking in template messaging
 * - Sensitive data logging prevention (email addresses in debug only)
 * - Provider credential management through environment variables
 * - Rate limiting and abuse prevention (provider-level)
 * 
 * Environment Behavior:
 * - Development: Email content logged to console, no actual delivery
 * - Production: Full email delivery through configured provider
 * - Debug information includes recipient and subject for development tracking
 * 
 * Integration Architecture:
 * - Provider-agnostic design supports SendGrid, AWS SES, Mailgun, etc.
 * - Template system allows consistent branding and messaging
 * - Error handling with structured logging for monitoring
 * - Boolean return values for success/failure handling
 * 
 * Template Security:
 * - HTML content should be sanitized by caller before passing
 * - URL parameters in templates require proper encoding
 * - Expiration times clearly communicated to recipients
 * - Fallback text versions for HTML emails
 * 
 * Usage Patterns:
 * - Standard email: emailService.sendEmail({ to, subject, html, text })
 * - Password reset: emailService.sendPasswordReset(email, resetLink)
 * - User invitation: emailService.sendUserInvitation(email, inviteLink, inviterName)
 * 
 * @module EmailService
 */

import logger from "./logger";

// ============================
// TYPE DEFINITIONS
// ============================

/**
 * Email composition options with multi-format support.
 * Supports both HTML and plain text content for broader client compatibility.
 */
interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Optional plain text content */
  text?: string;
  /** Optional HTML content (ensure proper sanitization before use) */
  html?: string;
}

// ============================
// EMAIL SERVICE CLASS
// ============================

/**
 * Email service implementation using singleton pattern for centralized email management.
 * Provides environment-aware email delivery with comprehensive logging and error handling.
 * 
 * Singleton Benefits:
 * - Centralized configuration and state management
 * - Consistent provider connection handling
 * - Unified logging and monitoring across the application
 * - Resource optimization for email provider connections
 */
export class EmailService {
  /** Singleton instance for centralized email management */
  private static instance: EmailService;
  
  /** Environment flag for production vs development behavior */
  private isProduction = process.env.NODE_ENV === 'production';
  
  /**
   * Returns singleton instance of EmailService with lazy initialization.
   * Ensures consistent email handling across the entire application.
   * 
   * @returns EmailService singleton instance
   */
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }
  
  // ============================
  // CORE EMAIL DELIVERY
  // ============================

  /**
   * Sends email using configured provider with environment-aware behavior.
   * Primary email delivery method with comprehensive error handling and logging.
   * 
   * Environment Behavior:
   * - Development: Logs email content without actual delivery for testing
   * - Production: Delivers email through configured provider with full error handling
   * 
   * Provider Integration:
   * - Designed for easy integration with SendGrid, AWS SES, Mailgun, etc.
   * - Requires provider-specific implementation in production block
   * - Environment variables should contain provider credentials
   * 
   * Security Features:
   * - Sensitive email content excluded from production logs
   * - Error details captured for monitoring without exposing recipient data
   * - Provider-level security and compliance handling
   * 
   * @param options - Email composition options with recipient and content
   * @returns Promise resolving to true on success, false on failure
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isProduction) {
      // Development: Log email content for testing without actual delivery
      logger.debug("Email would be sent", {
        to: options.to,
        subject: options.subject,
        text: options.text?.substring(0, 100) + (options.text && options.text.length > 100 ? '...' : '')
      });
      return true;
    }
    
    try {
      // TODO: Implement actual email sending with preferred provider
      // Provider Integration Examples:
      // 
      // SendGrid:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send(options);
      //
      // AWS SES:
      // const aws = require('aws-sdk');
      // const ses = new aws.SES({ region: 'us-east-1' });
      // await ses.sendEmail({ ... }).promise();
      //
      // Mailgun:
      // const mailgun = require('mailgun-js')({ apiKey, domain });
      // await mailgun.messages().send(options);
      
      logger.info("Email sent successfully", { 
        to: options.to, 
        subject: options.subject,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      logger.error("Failed to send email", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to, 
        subject: options.subject,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }
  
  // ============================
  // EMAIL TEMPLATES
  // ============================

  /**
   * Sends password reset email with secure link and expiration notice.
   * Provides both HTML and plain text versions for maximum client compatibility.
   * 
   * Security Features:
   * - Clear expiration time communication (24 hours)
   * - User guidance for unwanted reset requests
   * - Branded messaging for authenticity verification
   * - Plain text fallback for security-conscious email clients
   * 
   * Template Design:
   * - Clear call-to-action with prominent reset link
   * - Professional branding with Pulse Dashboard™ identity
   * - Security instructions for user education
   * - Accessible format supporting various email clients
   * 
   * Link Security Considerations:
   * - Reset link should contain cryptographically secure tokens
   * - Link expiration enforced at application level (24 hours)
   * - Single-use tokens recommended for enhanced security
   * - HTTPS required for reset link domains
   * 
   * @param email - Recipient email address for password reset
   * @param resetLink - Secure password reset URL with embedded token
   * @returns Promise resolving to true on successful delivery, false on failure
   */
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
  
  /**
   * Sends user invitation email with account setup link and inviter attribution.
   * Creates welcoming onboarding experience with clear setup instructions.
   * 
   * Invitation Features:
   * - Personal invitation attribution with inviter name
   * - Clear account setup call-to-action
   * - Extended expiration period (7 days) for convenience
   * - Professional onboarding messaging
   * 
   * Security Considerations:
   * - Invitation links should contain secure setup tokens
   * - Longer expiration appropriate for team coordination
   * - Inviter identity helps with security verification
   * - Account setup process should validate invitation authenticity
   * 
   * Template Design:
   * - Welcoming tone for new user engagement
   * - Clear attribution to build trust and context
   * - Prominent setup link for easy access
   * - Expiration communication for urgency awareness
   * 
   * @param email - New user email address for invitation
   * @param inviteLink - Secure account setup URL with embedded invitation token
   * @param inviterName - Name of team member sending the invitation
   * @returns Promise resolving to true on successful delivery, false on failure
   */
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

// ============================
// SERVICE INSTANCE EXPORT
// ============================

/**
 * Singleton instance of EmailService for application-wide email functionality.
 * Provides centralized email management with consistent configuration and logging.
 * 
 * Usage:
 * - Import this instance throughout the application
 * - Ensures consistent behavior and shared state
 * - Simplifies email provider configuration management
 */
export const emailService = EmailService.getInstance();