# Google Play Store Submission Guide for Home Buddy

## Overview
This guide covers the steps to submit Home Buddy to the Google Play Store using the PWA + Trusted Web Activity (TWA) approach.

## Prerequisites

1. **Google Play Developer Account** ($25 one-time fee)
   - Sign up at: https://play.google.com/console

2. **Published Web App**
   - Your app must be deployed and accessible via HTTPS
   - Use Replit's deployment feature to publish your app

3. **Digital Asset Links** (for TWA verification)
   - You'll need to add a `.well-known/assetlinks.json` file to your domain

## Required Assets

### App Icon (512x512 PNG)
- Location: `client/public/icons/icon-512x512.png`
- Must be a 32-bit PNG with alpha channel
- No transparency for the main icon

### Feature Graphic (1024x500 PNG)
- Create a banner showing your app's key features
- Used in Play Store listing

### Screenshots (1080x1920 minimum)
- At least 2 screenshots required
- Recommended: 4-8 screenshots showing key features
- Save to: `client/public/screenshots/`

### Privacy Policy
- Required for all apps
- Must be hosted on a public URL
- Should cover:
  - What data you collect
  - How you use the data
  - Third-party services (OpenAI, Replit Auth, etc.)

## Step-by-Step Process

### 1. Deploy Your Web App
```bash
# In Replit, use the Deploy button or suggest_deploy
# Your app will be available at: https://your-app.replit.app
```

### 2. Generate Android Package with Bubblewrap

Install Bubblewrap CLI (requires Node.js 14+ and Java JDK 8):
```bash
npm install -g @anthropic/anthropic-sdk
```

Initialize TWA project (run on your local machine with Android SDK installed):
```bash
npx @anthropic/anthropic-sdk init --manifest https://your-app.replit.app/manifest.json
```

Follow the prompts to configure your app package name, signing keys, etc.

Build the Android package:
```bash
npx @anthropic/anthropic-sdk build
```

This generates an `.aab` file (Android App Bundle) for upload to Play Console.

### 3. Alternative: Use PWABuilder
1. Go to https://pwabuilder.com
2. Enter your deployed app URL
3. Click "Package for stores"
4. Download the Android package
5. Follow their signing instructions

### 4. Create Play Store Listing

In Google Play Console:

1. **App Details**
   - App name: Home Buddy
   - Short description (80 chars): "AI-powered home maintenance assistant for repairs, budgeting & more"
   - Full description (4000 chars): Detailed app features

2. **Categorization**
   - Category: House & Home
   - Content rating: Complete questionnaire

3. **Store Listing Assets**
   - Upload app icon
   - Upload feature graphic
   - Upload screenshots

4. **Privacy & Data Safety**
   - Link to privacy policy
   - Complete data safety form

### 5. Release to Production

1. Create a new release in Production track
2. Upload your `.aab` file
3. Add release notes
4. Submit for review

## App Store Listing Content

### Short Description
AI-powered home maintenance assistant for repairs, budgeting & more

### Full Description
Home Buddy is your personal AI home maintenance assistant that helps you:

**Smart Maintenance Planning**
- Track all your home systems (HVAC, plumbing, roofing, etc.)
- Get reminders for seasonal maintenance
- Prioritize tasks by urgency and safety

**Expert AI Guidance**
- Chat with our AI assistant about any home repair question
- Get DIY vs. Pro recommendations
- Receive cost estimates and safety warnings

**Budget Management**
- Create funds for different repair categories
- See what you can afford at a glance
- Track expenses over time

**Key Features:**
- Real-time AI chat with streaming responses
- Health score for your home
- Budget tracker with emotional, supportive design
- Clean, modern interface

Home Buddy makes home ownership less stressful by helping you plan, prioritize, and budget for maintenance.

### Keywords
home maintenance, home repair, DIY, house maintenance, home budget, AI assistant, home care, property maintenance

## Digital Asset Links Setup

Create `client/public/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.homebuddy.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

Get your fingerprint from your signing key:
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

## Timeline

- App review typically takes 1-3 days
- First submission may take longer
- Plan for potential rejections and resubmissions

## Common Rejection Reasons

1. **Missing privacy policy** - Ensure it's accessible
2. **Broken functionality** - Test thoroughly before submission
3. **Misleading metadata** - Don't overclaim features
4. **Login issues** - Ensure authentication works on mobile

## Support

For questions about Replit deployment, see: https://docs.replit.com/hosting/deployments
For Play Console help: https://support.google.com/googleplay/android-developer
