# Replit Secrets Setup Guide

## How to Add Secrets in Replit

1. **Open the Secrets panel**:
   - Click on the "Tools" icon in the left sidebar
   - Select "Secrets" from the menu

2. **Add the following secrets**:

### Required Secrets

| Secret Name | Value | Description |
|------------|-------|-------------|
| `SCREENSHOTONE_API_KEY` | Your API access key | From screenshotone.com dashboard |
| `DATABASE_URL` | PostgreSQL connection string | Your database connection |

### Optional Secrets

| Secret Name | Value | Description |
|------------|-------|-------------|
| `OPENAI_API_KEY` | OpenAI API key | For AI-powered analysis |
| `PAGESPEED_API_KEY` | PageSpeed API key | For performance metrics |
| `GOOGLE_CLIENT_ID` | OAuth client ID | For GA4 integration |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | For GA4 integration |

## Important Notes

- **Never commit API keys to the repository**
- Replit Secrets are automatically available as environment variables
- The server reads these on startup (no code changes needed)
- After adding secrets, restart the server for them to take effect

## Verification

To verify secrets are properly configured:

1. Check screenshot functionality:
```bash
curl -X GET "http://localhost:5000/api/effectiveness/test-screenshot?url=https://example.com" \
  -b cookies.txt | jq '.capabilities.apiAvailable'
```

2. Check in server logs for successful API usage:
```
[INFO] Using Screenshotone.com API for screenshot
[INFO] Screenshot captured successfully via API
```

## Security Best Practices

1. **Rotate keys regularly** - Update API keys periodically
2. **Use minimum permissions** - Only grant necessary access
3. **Monitor usage** - Check API dashboards for unusual activity
4. **Keep .env.example updated** - Document required variables without values
5. **Never share Replit with secrets** - Remove or rotate keys before sharing