# Performance Review Helper

A Next.js application that helps you write your performance review by analyzing your GitHub contributions (PRs, issues, PR reviews, commits) for a specific organization and date range.

## Features

- 📊 **Comprehensive GitHub Data Analysis**: Fetches and displays all your contributions including:
  - Pull Requests (opened, merged, closed)
  - Issues (opened, closed)
  - PR Reviews (approved, changes requested, commented)
  - Commits
  - Statistics (lines added/deleted, repositories contributed to)

- 📝 **Performance Review Questions**: Pre-filled forms for all 5 performance review questions:
  1. Progress on goals and objectives
  2. AI utilization in day-to-day work
  3. Values demonstrated
  4. Skills to develop
  5. Additional information

- 💡 **AI-Powered Insights**: Automatically generates suggested talking points based on your contributions

- 📥 **Export Functionality**: Export your answers as a text file

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

### Setup

1. **GitHub Token (Recommended)**: 
   - Create a GitHub Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens)
   - Select scopes: `repo` (for private repos) or `public_repo` (for public repos only)
   - The token increases API rate limits from 60 to 5000 requests per hour
   - **Note**: You can use the app without a token, but rate limits may apply

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Enter Configuration**:
   - Organization name (e.g., "MetaMask")
   - Your GitHub username
   - GitHub token (optional but recommended)
   - Date range (or use presets: "Second Half of Year" or "Full Year")

2. **Fetch Contributions**: Click "Fetch Contributions" to retrieve your GitHub data

3. **Review Your Data**: Browse through your PRs, issues, reviews, and commits

4. **Answer Questions**: Fill out the performance review questions with suggested insights

5. **Export**: Click "Export Answers" to download your responses as a text file

## How It Works

The application:
- Fetches all repositories in the specified organization
- Filters contributions by your username and date range
- Aggregates statistics and generates insights
- Provides context-aware suggestions for your performance review

## API Rate Limits

- **Without token**: 60 requests/hour (may be insufficient for large organizations)
- **With token**: 5000 requests/hour (recommended)

If you hit rate limits, wait an hour or use a GitHub token.

## Technologies Used

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Octokit (GitHub API client)
- date-fns (date utilities)

## Notes

- The application only fetches data for repositories you have access to
- Private repository data requires a GitHub token with appropriate permissions
- Large organizations with many repositories may take several minutes to fetch all data
- The app respects GitHub API rate limits

## License

MIT
