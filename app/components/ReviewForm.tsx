'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { parseQuestions } from '@/lib/prompt-builder';
import { FetchedData, UserProfile, ParsedQuestion } from '@/app/types';

interface ReviewFormProps {
  data: FetchedData;
  profile: UserProfile;
  customQuestions: string;
  companyValues?: string;
  additionalContext?: string;
  claudeApiKey?: string;
}

export default function ReviewForm({
  data,
  profile,
  customQuestions,
  companyValues,
  additionalContext,
  claudeApiKey,
}: ReviewFormProps) {
  const { contributions, stats } = data;
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining: number; remainingDaily: number } | null>(null);

  // Parse questions when customQuestions changes
  useEffect(() => {
    const parsed = parseQuestions(customQuestions);
    setQuestions(
      parsed.map((text, idx) => ({
        id: `q-${idx}`,
        text,
        answer: '',
        aiSuggestion: '',
        isLoading: false,
      }))
    );
  }, [customQuestions]);

  const updateAnswer = (id: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answer } : q))
    );
  };

  const generateAIAnswer = async (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    // Update loading state
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, isLoading: true } : q))
    );

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          contributions,
          stats,
          profile,
          companyValues,
          additionalContext,
          userApiKey: claudeApiKey || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate answer');
      }

      // Update rate limit info
      if (result.rateLimit) {
        setRateLimitInfo(result.rateLimit);
      }

      // Update AI suggestion
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, aiSuggestion: result.answer, isLoading: false }
            : q
        )
      );

      // Show notice if using fallback AI
      if (result.notice) {
        console.log('AI Notice:', result.notice);
      }
    } catch (error: any) {
      console.error('Error generating AI answer:', error);
      alert(error.message || 'Failed to generate AI answer. Please try again.');
      
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isLoading: false } : q))
      );
    }
  };

  const generateAllAnswers = async () => {
    for (const question of questions) {
      if (!question.aiSuggestion) {
        await generateAIAnswer(question.id);
        // Small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  const useAISuggestion = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (question?.aiSuggestion) {
      updateAnswer(questionId, question.aiSuggestion);
    }
  };

  const exportAnswers = () => {
    const content = `
PERFORMANCE REVIEW ANSWERS
==========================
${profile.companyName}
${profile.currentPosition}${profile.targetPosition ? ` → ${profile.targetPosition}` : ''}
Review Period: ${format(parseISO(data.dateRange.start), 'MMM d, yyyy')} - ${format(parseISO(data.dateRange.end), 'MMM d, yyyy')}

${questions
  .map(
    (q, idx) => `
${idx + 1}. ${q.text}

${q.answer || '[No answer provided]'}
`
  )
  .join('\n---\n')}

---
Generated using Performance Review AI Helper
https://performance-review.ai
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-review-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No questions detected
        </h3>
        <p className="text-gray-600">
          Please go back and add your performance review questions to generate AI-powered answers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Your Performance Review Answers
            </h2>
            <p className="text-gray-600 mt-1">
              {questions.length} question{questions.length !== 1 ? 's' : ''} detected from your input
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generateAllAnswers}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium flex items-center gap-2"
            >
              <span>✨</span>
              Generate All with AI
            </button>
            <button
              onClick={exportAnswers}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>📥</span>
              Export Answers
            </button>
          </div>
        </div>

        {/* Rate limit info */}
        {rateLimitInfo && !claudeApiKey && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <span>⚡</span>
              <span>
                Free tier: {rateLimitInfo.remaining} generations remaining this minute, {rateLimitInfo.remainingDaily} remaining today
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Questions */}
      {questions.map((question, idx) => (
        <div
          key={question.id}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <label className="block text-lg font-semibold text-gray-900">
              <span className="text-blue-600 mr-2">{idx + 1}.</span>
              {question.text}
            </label>
            
            <button
              onClick={() => generateAIAnswer(question.id)}
              disabled={question.isLoading}
              className="shrink-0 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {question.isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Generate with AI</span>
                </>
              )}
            </button>
          </div>

          {/* AI Suggestion */}
          {question.aiSuggestion && (
            <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-900">
                  ✨ AI-Generated Suggestion
                </span>
                <button
                  onClick={() => useAISuggestion(question.id)}
                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  Use this answer
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {question.aiSuggestion}
              </p>
            </div>
          )}

          {/* Answer textarea */}
          <textarea
            value={question.answer}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Write your answer here, or use the AI-generated suggestion above..."
          />
        </div>
      ))}

      {/* Quick Stats Reference */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📊</span>
          Quick Reference - Your Contributions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPRs}</div>
            <div className="text-sm text-gray-600">Pull Requests</div>
            <div className="text-xs text-gray-500">{stats.mergedPRs} merged</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{stats.totalIssues}</div>
            <div className="text-sm text-gray-600">Issues</div>
            <div className="text-xs text-gray-500">{stats.closedIssues} closed</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">{stats.totalReviews}</div>
            <div className="text-sm text-gray-600">PR Reviews</div>
            <div className="text-xs text-gray-500">{stats.approvedReviews} approved</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-orange-600">{stats.totalCommits}</div>
            <div className="text-sm text-gray-600">Commits</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-lg font-semibold text-gray-900">
              +{stats.totalAdditions.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Lines Added</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-lg font-semibold text-gray-900">
              -{stats.totalDeletions.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Lines Deleted</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-lg font-semibold text-gray-900">
              {stats.reposContributed}
            </div>
            <div className="text-sm text-gray-600">Repositories</div>
          </div>
        </div>
      </div>
    </div>
  );
}
