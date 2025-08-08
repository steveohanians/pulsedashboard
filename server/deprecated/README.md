# Deprecated/Prepared Infrastructure

This directory contains prepared infrastructure code that is not currently active but preserved for future implementation.

## emailService.ts

**Status**: Prepared for production use, currently unused  
**Reason**: Complete email infrastructure with templates, but no active provider configuration  
**Date moved**: 2025-08-08

### Future Implementation Requirements:
1. Configure email provider (SendGrid, SES, or Mailgun)
2. Add environment variables for provider credentials
3. Import and use emailService in the following routes that have TODO placeholders:

**Routes needing email integration:**
- `server/routes.ts:2351` - Password reset for admin users
- `server/routes.ts:2422` - User invitation emails  
- `server/routes.ts:2466` - Forgot password functionality
- `server/auth.ts:164` - Auth-based password reset

### Ready-to-use Methods:
- `emailService.sendEmail(options)` - Core email sending
- `emailService.sendPasswordReset(email, resetLink)` - Password reset template
- `emailService.sendUserInvitation(email, inviteLink, inviterName)` - User invite template

### To Reactivate:
1. Move `emailService.ts` back to `server/utils/`
2. Configure production email provider
3. Replace TODO comments with actual emailService calls
4. Add provider-specific environment variables