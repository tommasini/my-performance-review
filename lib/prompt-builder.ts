import { ContributionData, ContributionStats, UserProfile, PullRequest, Commit, StandupConfig } from '@/app/types';

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

export function buildStandupPrompt(
  config: StandupConfig,
  contributions: ContributionData,
  stats: ContributionStats,
  profile: UserProfile,
): string {
  const frequency = config.frequency;
  const hasMilestone = !!(config.milestone && config.milestone.trim().length > 0);
  const openPRs = contributions.pullRequests.filter(pr => pr.state === 'open');
  const mergedPRs = contributions.pullRequests.filter(pr => pr.state === 'merged' || pr.mergedAt);
  const openIssues = contributions.issues.filter(i => i.state === 'open');
  const recentCommits = getSignificantCommits(contributions.commits).slice(0, 10);
  const timeframe = frequency === 'daily' ? 'today' : 'this week';
  const lookbackPeriod = frequency === 'daily' ? 'yesterday' : 'this past week';

  const inProgressTickets = contributions.tickets.filter(
    t => t.status.toLowerCase().includes('progress') || t.status.toLowerCase().includes('review')
  );

  // Build milestone header lines for the output template
  const milestoneHeaderLines = hasMilestone
    ? [
        `Milestone (link to epic/bug): ${config.milestone}${config.epicLink ? ` ${config.epicLink}` : ''}`,
        ...(config.originalTargetDate ? [`Original Target Date: ${config.originalTargetDate}`] : []),
        ...(config.targetDate ? [`Target Date: ${config.targetDate}`] : []),
      ].join('\n')
    : '';

  // Scoping instruction
  const scopingInstruction = hasMilestone
    ? `Focus the analysis on work related to the milestone "${config.milestone}". Reference the target date when assessing status.`
    : `No specific milestone was provided. Analyze ALL contributions across the period. Identify natural groupings or themes (e.g. by repo, feature area, or type of work — bug fixes, new features, reviews, CI/CD, etc.). Present key updates grouped by theme where it adds clarity.`;

  // Status guidance
  const statusGuidance = hasMilestone
    ? `🟢 On Track — steady progress, no blockers, target date is achievable
🟡 At Risk — PRs awaiting review, minor blockers, or tight deadline
🔴 Off Track — significant blockers, missed deliverables, or target date clearly at risk`
    : `🟢 On Track — solid output, no blockers, work is progressing well
🟡 At Risk — some items waiting a long time for review, or minor blockers
🔴 Off Track — very little output, many open blockers, or sustained low activity`;

  // Custom format instruction
  const formatInstruction = config.customFormat
    ? `The user has provided a custom standup format. Follow it exactly, filling in the placeholders with real content from the contribution data:\n\n${config.customFormat}`
    : `Produce the standup message using this exact format (replace the placeholder text with real content):

${milestoneHeaderLines ? milestoneHeaderLines + '\n' : ''}Status: [choose one: 🟢 On Track | 🟡 At Risk | 🔴 Off Track]

*Key updates and Risks:*
- [bullet summarising a key thing completed ${lookbackPeriod} — reference specific PR title or issue name]
- [another key update or risk / blocker]
(continue for all significant items)

*Next Steps:*
- [main priority for ${timeframe}]
- [another priority]

*PRs that need attention from the team:*
- [PR title] — [full PR URL]
(or "None pending" if all PRs are merged)`;

  return `You are generating a professional async standup update for ${profile.currentPosition} at ${profile.companyName}.
This message will be pasted directly into Slack. Output ONLY the standup message — no preamble, no explanation, no markdown code fences, no JSON.

STANDUP FREQUENCY: ${frequency.toUpperCase()} — ${frequency === 'daily' ? 'Keep bullet points concise. Focus on what was done yesterday and what is planned for today.' : "Provide slightly more detail. Summarise the week's progress and set clear priorities."}

═══════════════════════════════════════════════════════════════
CONTRIBUTION DATA (use this as the factual basis — every item listed here is real):
═══════════════════════════════════════════════════════════════
Merged PRs (${mergedPRs.length} total — include the most impactful ones in key updates):
${mergedPRs.slice(0, 50).map(pr => `- ${pr.title} (${pr.repo})${pr.url && pr.url !== '#' ? ` — ${pr.url}` : ''}`).join('\n') || '- None'}

Open PRs requiring team review (${openPRs.length} total — list ALL of these in "PRs that need attention"):
${openPRs.slice(0, 30).map(pr => `- ${pr.title} (${pr.repo}) — ${pr.url}`).join('\n') || '- None'}

Open Issues (${openIssues.length} total):
${openIssues.slice(0, 15).map(i => `- ${i.title} (${i.repo}) — ${i.state}`).join('\n') || '- None'}

Code reviews given (${stats.totalReviews} total, ${stats.approvedReviews} approved):
${contributions.reviews.slice(0, 12).map(r => {
  const label = r.state === 'APPROVED' ? 'approved' : r.state === 'CHANGES_REQUESTED' ? 'requested changes on' : 'commented on';
  return `- ${label}: "${r.prTitle}" (${r.repo})${r.prUrl ? ` — ${r.prUrl}` : ''}`;
}).join('\n') || '- None'}

${inProgressTickets.length > 0 ? `In-progress tickets:\n${inProgressTickets.slice(0, 5).map(t => `- [${t.key}] ${t.title} (${t.status})`).join('\n')}` : ''}
${recentCommits.length > 0 ? `\nNotable commits:\n${recentCommits.map(c => `- ${c.message.split('\n')[0]} (${c.repo})`).join('\n')}` : ''}

Overall: ${stats.mergedPRs} merged PRs · ${stats.totalAdditions.toLocaleString()} lines added · ${stats.totalDeletions.toLocaleString()} lines deleted · ${stats.reposContributed} repo(s) · ${stats.totalReviews} reviews given

═══════════════════════════════════════════════════════════════
INSTRUCTIONS:
═══════════════════════════════════════════════════════════════
${scopingInstruction}

Choose the status based on the evidence:
${statusGuidance}

${formatInstruction}

Rules:
- Use Slack formatting: *bold* for section headers, - for bullets, bare URLs (no markdown links)
- Every bullet must reference a specific PR title, issue name, or metric — no vague filler
- List ALL open PRs in the "PRs that need attention" section with their full URLs
- Do NOT wrap output in code fences, do NOT output JSON, do NOT add any text before or after the standup message`;
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

