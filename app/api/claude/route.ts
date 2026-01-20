import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contributions, stats, question, claudeApiKey } = body;

    if (!claudeApiKey) {
      return NextResponse.json(
        { error: 'Claude API key is required' },
        { status: 400 }
      );
    }

    // Prepare context from contributions
    const mergedPRs = contributions.pullRequests.filter(
      (pr: any) => pr.state === 'merged' || pr.mergedAt
    );

    const prDetails = mergedPRs
      .slice(0, 50) // Limit to avoid token limits
      .map((pr: any) => ({
        title: pr.title,
        repo: pr.repo,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        url: pr.url,
      }));

    const issues = contributions.issues.slice(0, 20).map((issue: any) => ({
      title: issue.title,
      repo: issue.repo,
      state: issue.state,
      url: issue.url,
    }));

    const reviews = contributions.reviews.slice(0, 20).map((review: any) => ({
      prTitle: review.prTitle,
      repo: review.repo,
      state: review.state,
    }));

    // Build prompt based on question
    let prompt = '';
    if (question === 'q1') {
      prompt = `You are helping write a performance review answer. Based on the following GitHub contributions, write a detailed, professional answer to this question:

"What progress have you made on your goals and objectives over the last 6-months? Describe the impact on the success of your team, department, and organization. If applicable, also identify any blockers or challenges you faced."

CONTRIBUTIONS DATA:
- Merged ${stats.mergedPRs} pull requests across ${stats.reposContributed} repositories
- ${stats.totalAdditions.toLocaleString()} lines added, ${stats.totalDeletions.toLocaleString()} lines deleted
- Reviewed ${stats.totalReviews} pull requests (${stats.approvedReviews} approved)
- Opened ${stats.totalIssues} issues

KEY PULL REQUESTS (merged):
${prDetails.map((pr: any, idx: number) => `${idx + 1}. "${pr.title}" (${pr.repo}) - +${pr.additions}/-${pr.deletions} lines`).join('\n')}

KEY ISSUES:
${issues.map((issue: any, idx: number) => `${idx + 1}. "${issue.title}" (${issue.repo}) - ${issue.state}`).join('\n')}

KEY REVIEWS:
${reviews.map((review: any, idx: number) => `${idx + 1}. Reviewed "${review.prTitle}" (${review.repo}) - ${review.state}`).join('\n')}

REQUIREMENTS:
1. Be specific about WHAT features/improvements you worked on (mention actual PR titles and what they accomplished)
2. Explain the IMPACT of each major contribution on the product, team, and organization
3. Group related work by theme/area (e.g., "I focused on security improvements including...", "I delivered several features such as...")
4. Be professional but specific - avoid generic statements
5. If there were blockers or challenges, mention them briefly
6. Keep it concise but detailed (2-3 paragraphs)
7. Focus on outcomes and impact, not just numbers

Write the answer as if you are the contributor, using first person.`;
    } else if (question === 'q3') {
      prompt = `You are helping write a performance review answer. Based on the following GitHub contributions, write a detailed, professional answer to this question:

"What's one value that you feel like you've demonstrated over the last 6-months? If you would like, provide 1-2 examples below."

COMPANY VALUES (you MUST choose ONE of these):
1. Kindness: Acting with intention and strength across their company and broader ecosystem.
2. Community: Cultivating interconnectedness and unlocking potential through collective effort (the "we").
3. Evolution: Committing to continuous growth, adapting to an ever-changing landscape, and embodying it in human and technological journeys.
4. Innovation: Believing in the power to change the world through novel, decentralized solutions, inherent in their identity.
5. Impact: Delivering exceptional products and supporting the mission through persistent effort, aiming for a more equitable society.

CONTRIBUTIONS DATA:
- Merged ${stats.mergedPRs} pull requests
- Reviewed ${stats.totalReviews} pull requests (${stats.approvedReviews} approved)
- Opened ${stats.totalIssues} issues
- Contributed across ${stats.reposContributed} repositories

KEY PULL REQUESTS (merged):
${prDetails.slice(0, 20).map((pr: any, idx: number) => `${idx + 1}. "${pr.title}" (${pr.repo})`).join('\n')}

KEY REVIEWS:
${reviews.slice(0, 10).map((review: any, idx: number) => `${idx + 1}. Reviewed "${review.prTitle}" (${review.repo}) - ${review.state}`).join('\n')}

REQUIREMENTS:
1. You MUST select ONE of the five company values listed above (Kindness, Community, Evolution, Innovation, or Impact)
2. Start your answer by clearly stating which value you demonstrated (e.g., "The value I've demonstrated most clearly is [Value Name].")
3. Provide 1-2 specific examples from the contributions above that demonstrate this value
4. Explain how those examples specifically relate to the value's definition
5. Be specific - mention actual PR titles, reviews, or work done
6. Keep it concise (1-2 paragraphs)
7. Make sure the examples clearly show how the work embodies the chosen value

Write the answer as if you are the contributor, using first person.`;
    } else if (question === 'q2') {
      prompt = `You are helping write a performance review answer. Based on the following GitHub contributions and context, write a detailed, professional answer to this question:

"How are you utilizing AI in your day-to-day work? Please provide two specific examples of how you have used AI to improve the quality, efficiency, or innovation of your work. Make sure to identify what did and did not work, as well as share any blockers or challenges you faced in using AI tools."

CONTEXT PROVIDED:
- Used Cursor extensively: Tried both extensive work and small work. Small work brought more impact to the product than big refactors at one time. Still evolving on using more git worktree and server features. Q1 2026 started taking more advantages out of it.
- Used AI to create slide presentations: Didn't work well with Google Slides and Google AI. Works optimally if you create a slider website instead. This was super interesting.

CONTRIBUTIONS DATA (for context):
- Merged ${stats.mergedPRs} pull requests across ${stats.reposContributed} repositories
- ${stats.totalAdditions.toLocaleString()} lines added, ${stats.totalDeletions.toLocaleString()} lines deleted

REQUIREMENTS:
1. Provide two specific examples based on the context above (Cursor usage and presentation creation)
2. For each example, explain:
   - How it improved quality, efficiency, or innovation
   - What worked well
   - What didn't work well
   - Any blockers or challenges faced
3. Be specific about the impact (e.g., "small work brought more impact than big refactors")
4. Mention the learning/evolution aspect (e.g., "still evolving", "Q1 2026 started taking more advantages")
5. Keep it professional and detailed (2-3 paragraphs)

Write the answer as if you are the contributor, using first person.`;
    } else if (question === 'q4') {
      prompt = `You are helping write a performance review answer. Based on the following context, write a detailed, professional answer to this question:

"What are 2-3 skills, knowledge, or behaviors you would like to develop over the next 6-months? Describe how these will impact goals and performance for you, your team, or the organization."

CONTEXT PROVIDED:
- Current role: Senior Software Engineer 2
- Goal: Become a Staff Software Engineer
- Current work: Working on CI, deprecating Bitrise in the organization to only use GitHub Actions, to have more general knowledge
- Manager feedback: Identified as a "solver" according to the book "Software Staff Engineer" (a leadership behind management path book), so need to work on other aspects beyond just solving problems

CONTRIBUTIONS DATA (for context):
- Merged ${stats.mergedPRs} pull requests across ${stats.reposContributed} repositories
- Reviewed ${stats.totalReviews} pull requests
- Contributed across ${stats.reposContributed} repositories

REQUIREMENTS:
1. Identify 2-3 skills/knowledge/behaviors that would help transition from Senior Engineer 2 to Staff Engineer
2. Consider the "solver" identification - suggest skills beyond just problem-solving (e.g., strategic thinking, mentoring, system design, cross-team collaboration, technical leadership)
3. Mention the CI/GitHub Actions work as one area of growth
4. For each skill, explain:
   - How it will impact personal goals (becoming Staff Engineer)
   - How it will impact team performance
   - How it will impact the organization
5. Be specific and actionable
6. Keep it professional (2-3 paragraphs)

Write the answer as if you are the contributor, using first person.`;
    } else if (question === 'q5') {
      prompt = `You are helping write a performance review answer. Based on the following GitHub contributions, write a detailed, professional answer to this question:

"If you would like, provide any additional information that wasn't captured in the above form. Remember to include specific behaviors and situations and describe their impact."

CONTRIBUTIONS DATA:
- Merged ${stats.mergedPRs} pull requests across ${stats.reposContributed} repositories
- Reviewed ${stats.totalReviews} pull requests (${stats.approvedReviews} approved)
- Opened ${stats.totalIssues} issues
- ${stats.totalAdditions.toLocaleString()} lines added, ${stats.totalDeletions.toLocaleString()} lines deleted

KEY PULL REQUESTS (merged):
${prDetails.slice(0, 30).map((pr: any, idx: number) => `${idx + 1}. "${pr.title}" (${pr.repo}) - +${pr.additions}/-${pr.deletions} lines`).join('\n')}

KEY ISSUES:
${issues.map((issue: any, idx: number) => `${idx + 1}. "${issue.title}" (${issue.repo}) - ${issue.state}`).join('\n')}

SPECIFIC CONTEXT TO HIGHLIGHT:
- Worked on December 23rd while everyone else was on holidays, since the company had a production incident (P0 week) and closed for holidays. Focused on a critical issue during this time.

REQUIREMENTS:
1. Identify behaviors, situations, or contributions NOT already covered in previous answers
2. Highlight the December 23rd work during holidays on critical production issue - this shows dedication, ownership, and reliability
3. Look for other patterns in the contributions that show:
   - Going above and beyond
   - Taking ownership during critical times
   - Reliability and availability
   - Any unique contributions or situations
4. For each point, include:
   - Specific behavior or situation
   - The impact on the team/organization
5. Be specific and use actual examples from the contributions
6. Keep it professional and concise (1-2 paragraphs)

Write the answer as if you are the contributor, using first person.`;
    } else {
      return NextResponse.json(
        { error: 'Invalid question type' },
        { status: 400 }
      );
    }

    // Call Claude API with retry logic
    let response;
    let data;
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        data = await response.json();

        if (response.ok) {
          break; // Success, exit retry loop
        }

        // Check if it's a rate limit or overload error
        const errorMsg = data.error?.message?.toLowerCase() || '';
        const errorType = data.error?.type?.toLowerCase() || '';
        if (errorMsg.includes('overloaded') || 
            errorType.includes('overloaded') ||
            errorMsg.includes('rate limit') ||
            response.status === 429) {
          retries--;
          if (retries > 0) {
            // Wait before retrying (longer exponential backoff for overload)
            const waitTime = (4 - retries) * 5000; // 5s, 10s, 15s
            console.log(`Rate limited or overloaded, retrying in ${waitTime}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // For other errors, don't retry
        break;
      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          const waitTime = (4 - retries) * 2000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!response || !response.ok) {
      // Better error handling - show the actual API error
      const errorType = data?.error?.type || '';
      const errorMsg = data?.error?.message || data?.error || (lastError instanceof Error ? lastError.message : 'Failed to call Claude API');
      
      // Provide helpful message for overload errors
      if (errorType === 'overloaded_error' || errorMsg.toLowerCase().includes('overloaded')) {
        const helpfulMessage = 'Claude API is currently overloaded. This can happen if the API key is being used by multiple people simultaneously. Please wait a few minutes and try again, or try during off-peak hours.';
        console.error('Claude API overloaded:', data || lastError);
        throw new Error(helpfulMessage);
      }
      
      console.error('Claude API error:', data || lastError);
      throw new Error(errorMsg);
    }

    const answer = data.content[0].text;

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('Error calling Claude API:', error);
    const errorMessage = error.message || 'Failed to generate answer with Claude';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
