# Deployment Guide - Performance Review AI

This guide walks you through deploying Performance Review AI to Vercel with your API keys.

## Prerequisites

- GitHub account (for Vercel integration)
- Vercel account (free tier works)
- API keys ready:
  - Claude (Anthropic): $25 credit
  - OpenAI: $20 credit
  - DeepSeek: $5 credit

---

## Step 1: Push to GitHub

If you haven't already, push your code to GitHub:

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Performance Review AI"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/performance-review-ai.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Choose your `performance-review-ai` repository
5. Vercel will auto-detect it's a Next.js project
6. **Before deploying**, click **"Environment Variables"** and add:

| Variable | Value |
|----------|-------|
| `CLAUDE_API_KEY` | `sk-ant-api03-...` (your Claude key) |
| `OPENAI_API_KEY` | `sk-...` (your OpenAI key) |
| `DEEPSEEK_API_KEY` | `sk-...` (your DeepSeek key) |

7. Click **"Deploy"**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (will prompt for project setup)
vercel

# Set environment variables
vercel env add CLAUDE_API_KEY
vercel env add OPENAI_API_KEY
vercel env add DEEPSEEK_API_KEY

# Redeploy to apply env vars
vercel --prod
```

---

## Step 3: Configure Environment Variables in Vercel

Go to your project in Vercel Dashboard → **Settings** → **Environment Variables**

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAUDE_API_KEY` | Anthropic Claude API key | `sk-ant-api03-xxxxx` |

### Recommended Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI fallback | `sk-xxxxx` |
| `DEEPSEEK_API_KEY` | DeepSeek fallback (cheapest) | `sk-xxxxx` |

### Optional Variables (Rate Limiting)

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `15` | Max requests/min per user |
| `RATE_LIMIT_REQUESTS_PER_DAY` | `60` | Max requests/day per user |
| `REDIS_URL` | - | For distributed rate limiting |

---

## Step 4: Test Your Deployment

### Quick Checklist

1. **Visit your deployment URL** (e.g., `https://your-app.vercel.app`)

2. **Test the health check endpoint**:
   ```
   https://your-app.vercel.app/api/ai
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "hasClaudeKey": true,
     "hasOpenAIKey": true,
     "hasDeepSeekKey": true
   }
   ```

3. **Test the full flow**:
   - [ ] Fill in profile (position, company, dates)
   - [ ] Add at least one data source OR use Manual Input mode
   - [ ] Add performance review questions
   - [ ] Check that "Free tier available" shows (confirms server keys work)
   - [ ] Fetch contributions (or use manual input)
   - [ ] Generate AI answer for one question
   - [ ] Verify answer is generated successfully

4. **Test rate limiting**:
   - Generate multiple answers quickly
   - Should show remaining count decreasing
   - After 15 in a minute, should show rate limit message

5. **Test Redis connection** (if configured):
   - Check Vercel function logs for "Connected to Redis (Upstash)"
   - Rate limiting should work consistently across requests
   - Try generating answers from different browsers/devices (same IP should share limits)

---

## Step 5: Optional - Add Redis for Production Rate Limiting

For production with multiple instances, add Redis. **Highly recommended for Vercel** since serverless functions are stateless.

### Using Upstash (Recommended - Free Tier)

1. Go to [upstash.com](https://upstash.com) and sign up
2. Create a new Redis database:
   - Click **"Create Database"**
   - Choose **"Regional"** (closest to your Vercel region)
   - Select **"Free"** tier
   - Click **"Create"**

3. Get your Redis connection string:
   - In your database dashboard, go to **"Redis Details"** tab
   - Find the **"Rest API"** section - you'll see:
     - REST endpoint (HTTPS URL)
     - REST token
   - Find the **"Redis"** section - this is what you need!
     - Copy the **Redis connection string** (looks like `rediss://default:PASSWORD@HOST.upstash.io:6379`)
     - ⚠️ **Important**: Use the `rediss://` (with 's' for TLS) connection string, NOT the REST endpoint

4. Add to Vercel environment variables:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `REDIS_URL` with the Redis connection string:
     ```
     REDIS_URL=rediss://default:YOUR_PASSWORD@your-redis.upstash.io:6379
     ```

5. **Redeploy** your app for the changes to take effect:
   ```bash
   vercel --prod
   ```
   Or trigger a new deployment in the Vercel dashboard

**Note**: The code automatically detects Upstash and enables TLS. Your connection string should start with `rediss://` (not `redis://`).

### Using Redis Cloud (Alternative)

1. Go to [redis.com/cloud](https://redis.com/cloud)
2. Create a free database
3. Get the connection string and add to Vercel

---

## Monitoring & Cost Management

### Estimated Costs (with your $50 budget)

| Provider | Budget | Requests | Users Supported* |
|----------|--------|----------|------------------|
| Claude ($25) | ~700-800 requests | ~12-13 full reviews |
| OpenAI ($20) | ~200-300 requests | ~3-5 full reviews |
| DeepSeek ($5) | ~2,500+ requests | ~40+ full reviews |

*Assuming 60 requests = 1 full review (user maxing daily limit)

### Monitor Usage

- **Claude**: [console.anthropic.com](https://console.anthropic.com) → Usage
- **OpenAI**: [platform.openai.com/usage](https://platform.openai.com/usage)
- **DeepSeek**: [platform.deepseek.com](https://platform.deepseek.com) → Usage

### Set Billing Alerts

1. **Claude**: Settings → Billing → Set usage limit
2. **OpenAI**: Settings → Billing → Usage limits
3. **DeepSeek**: Dashboard → Set spending limit

---

## Troubleshooting

### "No AI API key available" error

- Check Vercel environment variables are set correctly
- Redeploy after adding variables: `vercel --prod`
- Verify with health check: `/api/ai`

### Rate limiting not working / Redis connection issues

**Without Redis:**
- Rate limiting is per-instance (fine for low traffic)
- Users *might* be able to exceed limits across serverless instances
- For production, add `REDIS_URL` for distributed rate limiting

**With Upstash Redis:**
- Make sure you're using the **Redis protocol** connection string (`rediss://...`), NOT the REST endpoint
- Connection string should look like: `rediss://default:PASSWORD@HOST.upstash.io:6379`
- The code automatically detects Upstash and enables TLS
- Check Vercel function logs for Redis connection errors
- Verify `REDIS_URL` is set in Vercel environment variables
- **Redeploy** after adding `REDIS_URL` environment variable

### API calls failing

1. Check API key is valid and has credits
2. Check Vercel function logs: Dashboard → Deployments → Functions
3. Verify the fallback chain: Claude → OpenAI → DeepSeek

### Slow response times

- AI generation can take 10-30 seconds
- Vercel free tier has 10s timeout; Pro has 60s
- The app sets `maxDuration = 60` for AI routes

---

## Security Best Practices

1. **Never commit `.env.local`** - it's in `.gitignore`
2. **Use Vercel's encrypted environment variables**
3. **Set billing limits** on all AI providers
4. **Monitor usage** weekly during initial launch
5. **Rate limits protect you** - don't disable them

---

## Going Live Checklist

- [ ] All API keys added to Vercel
- [ ] Health check returns `hasClaudeKey: true`
- [ ] Full flow tested (profile → questions → fetch → generate)
- [ ] Rate limiting confirmed working
- [ ] Billing alerts set on AI providers
- [ ] Custom domain configured (optional)

---

## Need Help?

- Check Vercel deployment logs for errors
- API issues: Check provider status pages
- Rate limiting: Verify Redis connection or use in-memory fallback

Good luck with your deployment! 🚀
