import { ContributionData, ContributionStats, UserProfile, PullRequest, Commit } from '@/app/types';

/**
 * Categorize PRs by inferred type based on title keywords
 */
function categorizePRs(pullRequests: PullRequest[]): Map<string, PullRequest[]> {
  const categories = new Map<string, PullRequest[]>();
  
  const patterns: [string, RegExp][] = [
    ['🚀 Features', /\b(feat|feature|add|implement|new|introduce|create)\b/i],
    ['🐛 Bug Fixes', /\b(fix|bug|patch|resolve|issue|error|crash|broken)\b/i],
    ['⚡ Performance', /\b(perf|performance|optimize|speed|fast|cache|efficient)\b/i],
    ['🔧 Refactoring', /\b(refactor|cleanup|clean|restructure|reorganize|simplify)\b/i],
    ['📚 Documentation', /\b(doc|docs|readme|comment|documentation)\b/i],
    ['🧪 Testing', /\b(test|spec|coverage|e2e|unit|integration)\b/i],
    ['🔒 Security', /\b(security|auth|vulnerab|cve|permission|access)\b/i],
    ['🏗️ Infrastructure', /\b(ci|cd|deploy|docker|k8s|infra|pipeline|devops|build)\b/i],
  ];
  
  for (const pr of pullRequests) {
    let categorized = false;
    for (const [category, pattern] of patterns) {
      if (pattern.test(pr.title)) {
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category)!.push(pr);
        categorized = true;
        break;
      }
    }
    if (!categorized) {
      if (!categories.has('📦 Other')) categories.set('📦 Other', []);
      categories.get('📦 Other')!.push(pr);
    }
  }
  
  return categories;
}

/**
 * Extract significant commit messages (filter out trivial ones)
 */
function getSignificantCommits(commits: Commit[]): Commit[] {
  const trivialPatterns = [
    /^merge/i,
    /^wip/i,
    /^fixup/i,
    /^squash/i,
    /^revert/i,
    /^bump version/i,
    /^update (package|dependencies)/i,
    /^\./,
    /^[a-f0-9]{7,}$/i, // Just a commit hash
  ];
  
  return commits.filter(c => {
    const msg = c.message.split('\n')[0]; // First line only
    return msg.length > 10 && !trivialPatterns.some(p => p.test(msg));
  });
}

function formatContributions(contributions: ContributionData, stats: ContributionStats): string {
  const mergedPRs = contributions.pullRequests.filter(
    (pr) => pr.state === 'merged' || pr.mergedAt
  );

  // Categorize PRs for better understanding of work types
  const categorizedPRs = categorizePRs(mergedPRs);
  
  // Build categorized PR details
  let prDetails = '';
  for (const [category, prs] of categorizedPRs) {
    if (prs.length > 0) {
      prDetails += `\n${category}:\n`;
      prDetails += prs
        .slice(0, 10) // Top 10 per category
        .map((pr, idx) => `  ${idx + 1}. "${pr.title}" (${pr.repo}) - +${pr.additions || 0}/-${pr.deletions || 0} lines`)
        .join('\n');
      if (prs.length > 10) {
        prDetails += `\n  ... and ${prs.length - 10} more ${category.slice(2).toLowerCase()}`;
      }
      prDetails += '\n';
    }
  }

  const issueDetails = contributions.issues
    .slice(0, 25)
    .map((issue, idx) => `${idx + 1}. "${issue.title}" (${issue.repo}) - ${issue.state}${issue.comments > 0 ? ` [${issue.comments} comments]` : ''}`)
    .join('\n');

  const reviewDetails = contributions.reviews
    .slice(0, 25)
    .map((review, idx) => {
      const reviewType = review.state === 'APPROVED' ? '✓ Approved' : 
                         review.state === 'CHANGES_REQUESTED' ? '⚠ Changes Requested' : 
                         review.state === 'COMMENTED' ? '💬 Commented' : review.state;
      return `${idx + 1}. ${reviewType}: "${review.prTitle}" (${review.repo})`;
    })
    .join('\n');

  const ticketDetails = contributions.tickets
    .slice(0, 25)
    .map((ticket, idx) => `${idx + 1}. [${ticket.key}] "${ticket.title}" - ${ticket.status} (${ticket.type})`)
    .join('\n');

  // Include significant commit messages for additional context
  const significantCommits = getSignificantCommits(contributions.commits);
  const commitDetails = significantCommits
    .slice(0, 30)
    .map((commit, idx) => `${idx + 1}. ${commit.message.split('\n')[0]} (${commit.repo})`)
    .join('\n');

  // Calculate impact metrics
  const largestPRs = [...mergedPRs]
    .sort((a, b) => ((b.additions || 0) + (b.deletions || 0)) - ((a.additions || 0) + (a.deletions || 0)))
    .slice(0, 5);

  const highImpactSection = largestPRs.length > 0 ? `
HIGHEST IMPACT CONTRIBUTIONS (by code changes):
${largestPRs.map((pr, idx) => `${idx + 1}. "${pr.title}" (${pr.repo}) - +${pr.additions || 0}/-${pr.deletions || 0} lines changed`).join('\n')}
` : '';

  return `
CONTRIBUTION STATISTICS:
━━━━━━━━━━━━━━━━━━━━━━━━
• ${stats.mergedPRs} merged pull requests across ${stats.reposContributed} repositories
• ${stats.totalAdditions.toLocaleString()} lines added, ${stats.totalDeletions.toLocaleString()} lines deleted (net: ${(stats.totalAdditions - stats.totalDeletions).toLocaleString()})
• ${stats.totalReviews} pull requests reviewed (${stats.approvedReviews} approved, ${stats.totalReviews - stats.approvedReviews} with feedback)
• ${stats.totalIssues} issues (${stats.closedIssues} closed, ${stats.openIssues} open)
• ${stats.totalCommits} commits
${stats.totalTickets > 0 ? `• ${stats.totalTickets} tickets/tasks (${stats.resolvedTickets} resolved, ${stats.totalTickets - stats.resolvedTickets} in progress)` : ''}
${highImpactSection}
PULL REQUESTS BY CATEGORY:
━━━━━━━━━━━━━━━━━━━━━━━━
${prDetails || 'No merged PRs in this period'}

ISSUES CREATED/WORKED ON:
━━━━━━━━━━━━━━━━━━━━━━━━
${issueDetails || 'No issues in this period'}

CODE REVIEWS PROVIDED:
━━━━━━━━━━━━━━━━━━━━━━━━
${reviewDetails || 'No reviews in this period'}
${ticketDetails ? `
JIRA/TICKETS COMPLETED:
━━━━━━━━━━━━━━━━━━━━━━━━
${ticketDetails}` : ''}
${commitDetails ? `
NOTABLE COMMIT MESSAGES (showing technical depth):
━━━━━━━━━━━━━━━━━━━━━━━━
${commitDetails}` : ''}
`.trim();
}

export function buildPrompt(
  question: string,
  contributions: ContributionData,
  stats: ContributionStats,
  profile: UserProfile,
  companyValues?: string,
  additionalContext?: string
): string {
  const contributionsText = formatContributions(contributions, stats);
  
  // Build a more structured and effective prompt
  return `You are an expert performance review writer helping a ${profile.currentPosition} at ${profile.companyName} craft an outstanding performance review answer.
${profile.targetPosition ? `\nIMPORTANT: They are targeting a promotion to ${profile.targetPosition}. Frame achievements to demonstrate readiness for this next level.` : ''}

═══════════════════════════════════════════════════════════════
PERFORMANCE REVIEW QUESTION TO ANSWER:
═══════════════════════════════════════════════════════════════
"${question}"

═══════════════════════════════════════════════════════════════
ACTUAL CONTRIBUTIONS DATA (use this as evidence):
═══════════════════════════════════════════════════════════════
${contributionsText}
${companyValues ? `
═══════════════════════════════════════════════════════════════
COMPANY VALUES TO REFERENCE:
═══════════════════════════════════════════════════════════════
${companyValues}` : ''}
${additionalContext ? `
═══════════════════════════════════════════════════════════════
ADDITIONAL CONTEXT (not captured in code contributions):
═══════════════════════════════════════════════════════════════
${additionalContext}` : ''}

═══════════════════════════════════════════════════════════════
WRITING GUIDELINES:
═══════════════════════════════════════════════════════════════
1. **USE SPECIFIC EXAMPLES**: Reference actual PR titles, issues, or tickets from the data. Vague statements are weak; specific examples are powerful.

2. **SHOW IMPACT, NOT JUST ACTIVITY**: Don't just say "I merged 50 PRs." Instead, explain what those PRs achieved:
   - What problems did they solve?
   - What features did they enable?
   - What was the business/user impact?

3. **DEMONSTRATE TECHNICAL LEADERSHIP**: Highlight code reviews, mentoring, architectural decisions, and quality improvements.

4. **QUANTIFY WHEN MEANINGFUL**: Use numbers from the stats (lines of code, PRs merged, issues closed, repos contributed to) but frame them as impact, not just volume.

5. **WRITE IN FIRST PERSON**: As if the contributor is writing this themselves.

6. **BE CONFIDENT BUT AUTHENTIC**: Use strong, active voice. Avoid hedging language like "I think" or "maybe."

7. **OPTIMAL LENGTH**: 2-4 paragraphs. Long enough to be substantive, short enough to be read.
${profile.targetPosition ? `
8. **PROMOTION FRAMING**: Demonstrate behaviors and impact expected at the ${profile.targetPosition} level (broader scope, leadership, strategic thinking).` : ''}
${companyValues ? `
9. **VALUES ALIGNMENT**: Naturally connect your achievements to company values where authentic.` : ''}

═══════════════════════════════════════════════════════════════
Now write a compelling, evidence-based answer that will make a strong impression on reviewers.`;
}

export function parseQuestions(rawText: string): string[] {
  if (!rawText.trim()) return [];
  
  // Split by common patterns
  const lines = rawText.split(/\n+/);
  const questions: string[] = [];
  let currentQuestion = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if this line starts a new question
    const isNewQuestion = 
      /^\d+[\.\)]\s*/.test(trimmedLine) ||      // "1. Question" or "1) Question"
      /^[•\-\*]\s*/.test(trimmedLine) ||        // Bullet points
      /^Q\d*[\.:]\s*/i.test(trimmedLine) ||     // "Q1: Question" or "Q: Question"
      /^Question\s*\d*[\.:]/i.test(trimmedLine); // "Question 1:"
    
    if (isNewQuestion) {
      // Save previous question if exists
      if (currentQuestion.trim()) {
        questions.push(currentQuestion.trim());
      }
      // Start new question, removing the prefix
      currentQuestion = trimmedLine
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/^[•\-\*]\s*/, '')
        .replace(/^Q\d*[\.:]\s*/i, '')
        .replace(/^Question\s*\d*[\.:]\s*/i, '');
    } else {
      // Continue current question
      currentQuestion += ' ' + trimmedLine;
    }
  }
  
  // Don't forget the last question
  if (currentQuestion.trim()) {
    questions.push(currentQuestion.trim());
  }
  
  // Filter out questions that are too short (likely not real questions)
  return questions.filter(q => q.length > 15);
}

