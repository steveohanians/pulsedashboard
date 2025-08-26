# Screenshot Configuration Guide

## Overview
The Website Effectiveness Scoring system captures screenshots of analyzed websites. Due to system dependencies, we use the Screenshotone.com API service for reliable screenshot capture.

## Setup Instructions

### 1. Get Your API Key
1. Visit [Screenshotone.com](https://screenshotone.com)
2. Sign up for a free account (100 screenshots/month included)
3. Copy your API access key from the dashboard

### 2. Configure Environment Variable
Add the following to your `.env` file:
```bash
SCREENSHOTONE_API_KEY=your_api_key_here
```

### 3. Verify Setup
Test the screenshot functionality:
```bash
# With admin authentication
curl -X GET "http://localhost:5000/api/effectiveness/test-screenshot?url=https://example.com" \
  -b cookies.txt
```

## How It Works

### Screenshot Capture Flow
1. **API First**: System tries Screenshotone.com API (if configured)
2. **Playwright Fallback**: Falls back to local Playwright (if available)
3. **Graceful Degradation**: Continues scoring without screenshots if both fail

### HTML Content Analysis
The system independently fetches HTML content for analysis, which works regardless of screenshot availability:
- Uses native `fetch()` with proper headers
- Parses HTML with Cheerio for DOM analysis
- All scoring criteria can function with HTML alone

## Features

### Screenshotone.com API Features
- **Viewport Control**: 1440x900px default
- **Caching**: 24-hour cache for repeated requests
- **Ad Blocking**: Removes ads and cookie banners
- **Full Page Load**: Waits for network idle
- **JavaScript Rendering**: 2-second delay for SPAs

### Storage
Screenshots are saved to `uploads/screenshots/` and served at `/screenshots/*`

## Troubleshooting

### No Screenshots Appearing
1. Check if `SCREENSHOTONE_API_KEY` is set
2. Verify API key is valid (check Screenshotone dashboard)
3. Check server logs for error messages
4. Ensure `uploads/screenshots/` directory has write permissions

### API Limits
- Free tier: 100 screenshots/month
- Paid plans available for higher volume
- Screenshots are cached for 24 hours to reduce usage

### Testing Without API Key
The system will continue to work without screenshots:
- All scoring criteria still function using HTML analysis
- Frontend shows informative messages instead of broken images
- Screenshot status is tracked in the database

## Alternative Options

If you prefer not to use Screenshotone.com:

1. **Other API Services**: Modify `screenshot.ts` to use:
   - Urlbox.io
   - ApiFlash
   - Microlink

2. **Self-Hosted**: Deploy with proper dependencies:
   - Use Docker with Playwright pre-installed
   - Deploy to platforms that support system dependencies (Railway, Render)

3. **Local Development**: Install Playwright dependencies:
   ```bash
   npx playwright install chromium
   sudo npx playwright install-deps  # Linux only
   ```

## Database Fields

The system tracks screenshot status in `effectiveness_runs` table:
- `screenshot_url`: Path to saved screenshot
- `screenshot_method`: Method used (api/playwright/none)
- `screenshot_error`: Error message if capture failed