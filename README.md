# Performance Review AI 🚀

Generate compelling performance review answers powered by AI, using your actual contributions from GitHub, GitLab, Bitbucket, and Jira.

![Performance Review AI](https://img.shields.io/badge/AI-Powered-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Redis](https://img.shields.io/badge/Redis-Optional-red)

[![Buy me a coffee](https://img.shields.io/badge/Buy_me_a_coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/tommasini)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-lightgrey?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#ea4aaa)](https://github.com/sponsors/tommasini)

## ✨ Features

- **🔗 Multi-Source Data Fetching**: Connect to GitHub, GitLab, Bitbucket, and Jira to aggregate all your contributions
- **🤖 AI-Powered Answers**: Generate tailored answers using Claude AI (with OpenAI and DeepSeek fallbacks)
- **📊 Smart Categorization**: PRs are auto-categorized (features, bug fixes, performance, etc.)
- **📝 Custom Questions**: Paste your company's exact performance review questions
- **⭐ Company Values**: Include your company values for more relevant answers
- **🔒 Secure**: API keys are processed server-side only, never exposed to clients
- **🆓 Free Tier**: Limited free AI generations (15/min, 60/day)
- **💰 Bring Your Own Key**: Use your own API key for unlimited access
- **⚡ Redis Rate Limiting**: Production-ready rate limiting with Redis (optional)

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** or **pnpm**
- **Docker** (optional, for Redis)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/performance-review-ai.git
cd performance-review-ai
npm install
```

### 2. Configure Environment Variables

```bash
cp env.example .env.local
```

Edit `.env.local` with your API keys:

```env
# Required: At least one AI provider key
CLAUDE_API_KEY=sk-ant-api03-your-key-here

# Optional: Fallback AI providers (recommended)
OPENAI_API_KEY=sk-your-openai-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-key-here

# Optional: Redis for production-grade rate limiting
REDIS_URL=redis://localhost:6379
```

### 3. Start Redis (Optional but Recommended)

Redis provides distributed rate limiting. Without it, rate limiting uses in-memory storage (fine for development).

```bash
# Start Redis with Docker
docker-compose up -d redis

# Verify Redis is running
docker-compose ps
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 API Keys & Accounts Setup

### AI Providers (at least one required)

| Provider | Get API Key | Pricing | Notes |
|----------|------------|---------|-------|
| **Claude (Anthropic)** | [console.anthropic.com](https://console.anthropic.com/) | ~$3/M input tokens | Primary, best quality |
| **OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | ~$10/M input tokens | First fallback |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | ~$0.14/M input tokens | Budget fallback, great value |

### Data Source Tokens (optional but recommended)

Tokens increase API rate limits and allow access to private repositories.

| Source | Get Token | Permissions Needed |
|--------|-----------|-------------------|
| **GitHub** | [github.com/settings/tokens](https://github.com/settings/tokens) | `repo`, `read:user` |
| **GitLab** | [gitlab.com/-/user_settings/personal_access_tokens](https://gitlab.com/-/user_settings/personal_access_tokens) | `read_api`, `read_user` |
| **Bitbucket** | [bitbucket.org/account/settings/app-passwords](https://bitbucket.org/account/settings/app-passwords) | `Repositories: Read`, `Pull requests: Read` |
| **Jira** | [id.atlassian.com/manage/api-tokens](https://id.atlassian.com/manage/api-tokens) | API Token + your email |

---

## 📖 How to Use

### Step 1: Profile Setup
1. Enter your current position (e.g., "Senior Software Engineer")
2. Enter your target position for promotion framing (optional)
3. Enter your company name
4. Set the review period dates
5. Configure data sources:
   - **GitHub**: Username + optional organization + optional token
   - **GitLab**: Username + optional token + optional self-hosted URL
   - **Bitbucket**: Workspace + username + app password
   - **Jira**: Email + domain + API token + project key

### Step 2: Questions Input
1. Paste your company's performance review questions
2. Add company values (optional - AI will reference them)
3. Add additional context not in code (mentorship, presentations, etc.)
4. Optionally provide your own Claude API key for unlimited generations

### Step 3: Fetch Data
1. Click "Fetch My Contributions"
2. Wait 1-3 minutes while we gather:
   - Pull requests / Merge requests
   - Issues
   - Code reviews
   - Commits
   - Jira tickets (if configured)

### Step 4: Generate Answers
1. Review your fetched contributions summary
2. Click "Generate with AI" for each question (or "Generate All")
3. AI creates answers citing specific PRs, issues, and metrics
4. Edit as needed
5. Export to text file

---

## 🐳 Docker Setup

### Development (Redis only)

```bash
# Start Redis for rate limiting
docker-compose up -d redis

# Check status
docker-compose ps

# View Redis logs
docker-compose logs -f redis

# Stop Redis
docker-compose down
```

### Verify Redis Connection

```bash
# Test Redis is working
docker exec -it performance-review-redis redis-cli ping
# Should return: PONG
```

---

## 🔧 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAUDE_API_KEY` | Yes* | - | Anthropic Claude API key |
| `OPENAI_API_KEY` | No | - | OpenAI API key (fallback) |
| `DEEPSEEK_API_KEY` | No | - | DeepSeek API key (fallback) |
| `REDIS_URL` | No | - | Redis connection URL |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | 15 | Free tier limit per minute |
| `RATE_LIMIT_REQUESTS_PER_DAY` | No | 60 | Free tier limit per day |

*At least one AI provider key is required.

---

## 🏗️ Project Architecture

```
app/
├── api/
│   ├── ai/route.ts           # AI generation with multi-provider fallback
│   ├── contributions/route.ts # Unified data fetching from all sources
│   └── github/route.ts       # Legacy GitHub endpoint
├── components/
│   ├── ProfileSetup.tsx      # User profile & data source configuration
│   ├── QuestionsInput.tsx    # Performance review questions input
│   ├── ReviewForm.tsx        # AI-powered answer generation
│   ├── ContributionsView.tsx # Contribution statistics display
│   └── Donations.tsx         # Support the project
├── types/index.ts            # TypeScript type definitions
└── page.tsx                  # Main wizard flow

lib/
├── ai-providers.ts           # Claude, OpenAI, DeepSeek integrations
├── prompt-builder.ts         # Smart prompt generation with categorization
├── rate-limit.ts             # Redis-backed rate limiting
└── data-sources/
    ├── types.ts              # Adapter interface
    ├── github.ts             # GitHub adapter
    ├── gitlab.ts             # GitLab adapter
    ├── bitbucket.ts          # Bitbucket adapter
    ├── jira.ts               # Jira adapter
    └── index.ts              # Adapter factory
```

---

## 🔒 Security

- **Server-Side Only**: All API keys (AI providers, data sources) are processed server-side only
- **No Storage**: We don't store your tokens or contributions - everything is processed in-memory
- **Rate Limiting**: Built-in rate limiting prevents abuse (Redis-backed in production)
- **CORS**: Strict same-origin policy for API routes
- **User Keys**: Users can provide their own API keys (also processed securely server-side)

---

## 🛠️ Troubleshooting

### "Rate limit exceeded"
- Wait a few minutes or provide your own Claude API key
- Check if Redis is running: `docker-compose ps`

### "Failed to fetch contributions"
- Verify your username/organization is correct
- For private repos, provide a personal access token
- Check date range isn't too wide (start with 6 months)

### "No AI API key available"
- Ensure at least one of `CLAUDE_API_KEY`, `OPENAI_API_KEY`, or `DEEPSEEK_API_KEY` is set in `.env.local`
- Restart the dev server after changing environment variables

### Redis connection issues
```bash
# Check Redis is running
docker-compose ps

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis
```

### Data source authentication errors

| Source | Common Issue | Solution |
|--------|--------------|----------|
| GitHub | 401 Unauthorized | Regenerate token with `repo` scope |
| GitLab | 401 Unauthorized | Use Personal Access Token, not OAuth |
| Bitbucket | 401 Unauthorized | Use App Password, not account password |
| Jira | 401 Unauthorized | Use API Token + email as username |

---

## 🚢 Production Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

For Redis in production, use:
- [Upstash](https://upstash.com) (serverless Redis, free tier, **recommended for Vercel**)
- [Redis Cloud](https://redis.com/cloud)

**Upstash Setup:**
1. Create a free Redis database at [upstash.com](https://upstash.com)
2. Get the **Redis connection string** from dashboard (starts with `rediss://...`)
3. TLS is automatically enabled for Upstash connections

### Environment Variables for Production

Set these in your hosting provider's dashboard:

```env
CLAUDE_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
# For Upstash: Use rediss://default:PASSWORD@HOST.upstash.io:6379
REDIS_URL=rediss://default:YOUR_PASSWORD@your-redis.upstash.io:6379
RATE_LIMIT_REQUESTS_PER_MINUTE=15
RATE_LIMIT_REQUESTS_PER_DAY=60
```

---

## ☕ Support This Project

If this tool helped with your performance review, consider supporting:

### Fiat
- [☕ Buy me a coffee on Ko-fi](https://ko-fi.com/tommasini)
- [GitHub Sponsors](https://github.com/sponsors/tommasini)

### Crypto
- **Ethereum (ETH)**: `0x211D13b8F03e5F5D935e42bAf8D4E1724764F5a5`
- **Bitcoin (BTC)**: `bc1qdc8ugcaq7mn7l02kswtz78unpzgmw4vl33mr23`
- **Solana (SOL)**: `CdUmvJitNA1MHMM1gpn886s1UijhnUVbWPfkhYpJyKL5`

---

## 🛣️ Roadmap

- [x] GitHub integration
- [x] GitLab integration
- [x] Bitbucket integration
- [x] Jira integration
- [x] Custom questions support
- [x] AI fallback chain (Claude → OpenAI → DeepSeek)
- [x] Redis rate limiting
- [x] Smart PR categorization
- [x] Commit message analysis
- [ ] Export to PDF/Markdown
- [ ] Save/load review sessions
- [ ] Team analytics
- [ ] Slack integration

---

## 📄 License

MIT License - feel free to use and modify for your own purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ to help engineers showcase their impact.
