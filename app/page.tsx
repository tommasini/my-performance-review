'use client';

import { useState, useEffect, useRef } from 'react';
import { format, startOfYear } from 'date-fns';
import { UserProfile, DataSourceConfig, FetchedData, ContributionData, ContributionStats, AppMode, StandupConfig } from './types';
import ContributionsView from './components/ContributionsView';
import ReviewForm from './components/ReviewForm';
import ProfileSetup from './components/ProfileSetup';
import QuestionsInput from './components/QuestionsInput';
import StandupConfigComponent from './components/StandupConfig';
import StandupReview from './components/StandupReview';
import Donations from './components/Donations';

type Step = 'setup' | 'questions' | 'standup-config' | 'fetch' | 'review' | 'standup-review';
type InputMode = 'fetch' | 'manual';

const PERF_REVIEW_STEPS: Step[] = ['setup', 'questions', 'fetch', 'review'];
const STANDUP_STEPS: Step[] = ['setup', 'standup-config', 'fetch', 'standup-review'];

// Example template for manual input
const MANUAL_INPUT_EXAMPLE = `# My Contributions

## Pull Requests
- Implemented user authentication system (merged)
- Added caching layer for API responses (merged)
- Refactored database queries for better performance (merged)
- Fixed memory leak in background workers (merged)

## Code Reviews
- Reviewed 15+ pull requests from team members
- Provided detailed feedback on architecture decisions
- Mentored junior developers through code review process

## Issues / Bug Fixes
- Resolved critical production bug affecting 1000+ users
- Fixed race condition in payment processing
- Addressed security vulnerability in file uploads

## Key Achievements
- Reduced API response time by 40%
- Led migration to new microservices architecture
- Implemented CI/CD pipeline improvements
- Mentored 2 junior engineers`;

// Parse manual input text into FetchedData structure
function parseManualInput(input: string, startDate: string, endDate: string): FetchedData {
  const lines = input.split('\n').filter(line => line.trim());
  
  // Create basic contribution data from text
  const contributions: ContributionData = {
    pullRequests: [],
    issues: [],
    reviews: [],
    commits: [],
    tickets: [],
  };

  // Count items for stats
  let prCount = 0;
  let reviewCount = 0;
  let issueCount = 0;

  let currentSection = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect section headers
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      const header = trimmed.replace(/^#+\s*/, '').toLowerCase();
      if (header.includes('pull request') || header.includes('pr') || header.includes('merge')) {
        currentSection = 'pr';
      } else if (header.includes('review')) {
        currentSection = 'review';
      } else if (header.includes('issue') || header.includes('bug') || header.includes('fix')) {
        currentSection = 'issue';
      } else if (header.includes('achievement') || header.includes('key') || header.includes('impact')) {
        currentSection = 'achievement';
      } else {
        currentSection = 'other';
      }
      continue;
    }

    // Parse list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
      const content = trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      
      if (currentSection === 'pr' && content) {
        prCount++;
        contributions.pullRequests.push({
          title: content,
          number: prCount,
          state: content.toLowerCase().includes('merged') ? 'merged' : 'open',
          url: '#',
          createdAt: startDate,
          mergedAt: content.toLowerCase().includes('merged') ? endDate : null,
          repo: 'manual-input',
          additions: 100,
          deletions: 50,
          changedFiles: 5,
          source: 'github',
        });
      } else if (currentSection === 'review' && content) {
        reviewCount++;
        contributions.reviews.push({
          state: 'APPROVED',
          body: content,
          url: '#',
          createdAt: startDate,
          repo: 'manual-input',
          prNumber: reviewCount,
          prTitle: content,
          prUrl: '#',
          source: 'github',
        });
      } else if (currentSection === 'issue' && content) {
        issueCount++;
        contributions.issues.push({
          title: content,
          number: issueCount,
          state: 'closed',
          url: '#',
          createdAt: startDate,
          repo: 'manual-input',
          comments: 3,
          source: 'github',
        });
      }
    }
  }

  // If no structured data was parsed, create a minimal structure
  // so the AI still has the raw text to work with
  if (prCount === 0 && reviewCount === 0 && issueCount === 0) {
    // Add a single "achievement" PR to hold the content
    contributions.pullRequests.push({
      title: 'Manual contributions summary',
      number: 1,
      state: 'merged',
      url: '#',
      createdAt: startDate,
      mergedAt: endDate,
      repo: 'manual-input',
      additions: 500,
      deletions: 100,
      changedFiles: 20,
      source: 'github',
    });
    prCount = 1;
  }

  const stats: ContributionStats = {
    totalPRs: prCount,
    mergedPRs: contributions.pullRequests.filter(pr => pr.state === 'merged').length,
    openPRs: contributions.pullRequests.filter(pr => pr.state === 'open').length,
    closedPRs: 0,
    totalIssues: issueCount,
    openIssues: 0,
    closedIssues: issueCount,
    totalReviews: reviewCount,
    approvedReviews: reviewCount,
    totalCommits: prCount * 5, // Estimate
    totalAdditions: prCount * 100,
    totalDeletions: prCount * 50,
    reposContributed: 1,
    totalTickets: 0,
    resolvedTickets: 0,
  };

  return {
    contributions,
    stats,
    dateRange: { start: startDate, end: endDate },
    sources: ['github'],
  };
}

export default function Home() {
  // Current step in the wizard
  const [currentStep, setCurrentStep] = useState<Step>('setup');

  // Track the furthest step reached (for navigation)
  const [maxReachedStep, setMaxReachedStep] = useState<Step>('setup');

  // App mode: performance review or async standup
  const [appMode, setAppMode] = useState<AppMode>('performance-review');

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    currentPosition: '',
    targetPosition: '',
    companyName: '',
  });

  // Data sources state
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([
    { type: 'github', enabled: true, username: '', organization: '' },
  ]);

  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Performance review state
  const [customQuestions, setCustomQuestions] = useState('');
  const [companyValues, setCompanyValues] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');

  // Standup state
  const [standupConfig, setStandupConfig] = useState<StandupConfig>({
    frequency: 'daily',
  });

  // Session persistence
  const hasHydrated = useRef(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  // Input mode state (fetch from APIs or manual input)
  const [inputMode, setInputMode] = useState<InputMode>('fetch');
  const [manualInput, setManualInput] = useState('');

  // Fetching state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FetchedData | null>(null);

  // Derive step order from current mode
  const currentStepOrder = appMode === 'standup' ? STANDUP_STEPS : PERF_REVIEW_STEPS;
  const finalStep: Step = appMode === 'standup' ? 'standup-review' : 'review';
  const secondStep: Step = appMode === 'standup' ? 'standup-config' : 'questions';

  // Helper to update maxReachedStep when navigating forward
  const navigateToStep = (step: Step) => {
    const stepIndex = currentStepOrder.indexOf(step);
    const maxIndex = currentStepOrder.indexOf(maxReachedStep);
    if (stepIndex > maxIndex) {
      setMaxReachedStep(step);
    }
    setCurrentStep(step);
  };

  // Check if user can navigate to a specific step
  const canNavigateToStep = (step: Step) => {
    const stepIndex = currentStepOrder.indexOf(step);
    const maxIndex = currentStepOrder.indexOf(maxReachedStep);
    return stepIndex <= maxIndex || (step === finalStep && data !== null);
  };

  // Handle mode selection from setup — resets wizard state for the chosen path
  const handleSelectMode = (mode: AppMode) => {
    setAppMode(mode);
    setData(null);
    const nextStep: Step = mode === 'standup' ? 'standup-config' : 'questions';
    setMaxReachedStep(nextStep);
    setCurrentStep(nextStep);
  };

  // Initialize dates on client-side (perf review default: start of year → today)
  useEffect(() => {
    if (!startDate && !endDate) {
      const now = new Date();
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  }, [startDate, endDate]);

  // Save session to localStorage whenever persistent state changes.
  // Declared before the load effect so hasHydrated guard prevents overwriting
  // saved data with blank defaults on the initial mount render.
  useEffect(() => {
    if (!hasHydrated.current) return;
    try {
      localStorage.setItem('prf-session', JSON.stringify({
        profile,
        dataSources,
        claudeApiKey,
        appMode,
        standupFrequency: standupConfig.frequency,
        standupCustomFormat: standupConfig.customFormat,
        customQuestions,
        companyValues,
        additionalContext,
      }));
    } catch {
      // Ignore localStorage errors (private browsing, quota exceeded, etc.)
    }
  }, [profile, dataSources, claudeApiKey, appMode, standupConfig.frequency, standupConfig.customFormat, customQuestions, companyValues, additionalContext]);

  // Hydrate state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('prf-session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.dataSources) setDataSources(parsed.dataSources);
        if (parsed.claudeApiKey) setClaudeApiKey(parsed.claudeApiKey);
        if (parsed.appMode) setAppMode(parsed.appMode);
        if (parsed.standupFrequency || parsed.standupCustomFormat !== undefined) {
          setStandupConfig(prev => ({
            ...prev,
            frequency: parsed.standupFrequency ?? prev.frequency,
            ...(parsed.standupCustomFormat !== undefined && { customFormat: parsed.standupCustomFormat }),
          }));
        }
        if (parsed.customQuestions !== undefined) setCustomQuestions(parsed.customQuestions);
        if (parsed.companyValues !== undefined) setCompanyValues(parsed.companyValues);
        if (parsed.additionalContext !== undefined) setAdditionalContext(parsed.additionalContext);
        setSessionRestored(true);
      }
    } catch {
      // Ignore localStorage errors
    }
    hasHydrated.current = true;
  }, []);

  // Auto-calculate date range for standup mode based on frequency.
  // Daily → yesterday→today; Weekly → 7 days ago→today.
  useEffect(() => {
    if (appMode === 'standup') {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      if (standupConfig.frequency === 'daily') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
      } else {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        setStartDate(format(sevenDaysAgo, 'yyyy-MM-dd'));
      }
      setEndDate(today);
    }
  }, [appMode, standupConfig.frequency]);

  const fetchData = async () => {
    // Find enabled data sources with required fields
    const enabledSources = dataSources.filter(
      (ds) => ds.enabled && ds.username
    );

    if (enabledSources.length === 0) {
      setError('Please configure at least one data source with a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

      // Use the unified contributions API
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSources: enabledSources,
          startDate,
          endDate,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result: FetchedData & { errors?: Array<{ source: string; error: string }> } = await response.json();

      // Check if there were partial errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `${e.source}: ${e.error}`).join('; ');
        console.warn('Some data sources had errors:', errorMessages);
        // We still have data from other sources, so we'll continue but show a warning
      }

      setData(result);
      setMaxReachedStep(finalStep);
      setCurrentStep(finalStep);
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name === 'AbortError') {
        setError(
          'Request timed out. Try using a token or narrowing the date range.'
        );
      } else {
        setError(error.message || 'An error occurred');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Process manual input and create data
  const processManualInput = () => {
    if (!manualInput.trim()) {
      setError('Please enter your contributions');
      return;
    }

    setError(null);
    const parsedData = parseManualInput(manualInput, startDate, endDate);
    setData(parsedData);
    setMaxReachedStep(finalStep);
    setCurrentStep(finalStep);
  };

  const canProceedFromSetup = () => {
    const baseValid =
      profile.currentPosition &&
      profile.companyName &&
      startDate &&
      endDate;
    if (inputMode === 'manual') return !!baseValid;
    return !!(baseValid && dataSources.some((ds) => ds.enabled && ds.username));
  };

  const canProceedToFetch = () => {
    if (appMode === 'standup') {
      return true; // all standup fields are optional; frequency always has a default
    }
    return customQuestions.trim().length > 20;
  };

  const renderStepIndicator = () => {
    const steps = appMode === 'standup'
      ? [
          { key: 'setup', label: 'Setup', icon: '👤' },
          { key: 'standup-config', label: 'Standup', icon: '📋' },
          { key: 'fetch', label: 'Contributions', icon: '📊' },
          { key: 'standup-review', label: 'Output', icon: '📝' },
        ]
      : [
          { key: 'setup', label: 'Setup', icon: '👤' },
          { key: 'questions', label: 'Questions', icon: '❓' },
          { key: 'fetch', label: 'Contributions', icon: '📊' },
          { key: 'review', label: 'Review', icon: '✍️' },
        ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    const maxReachedIndex = currentStepOrder.indexOf(maxReachedStep);

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, idx) => {
          const stepKey = step.key as Step;
          const isNavigable = canNavigateToStep(stepKey);
          const isCompleted = idx < maxReachedIndex || (stepKey === finalStep && data !== null);
          const isCurrent = step.key === currentStep;

          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => {
                  if (isNavigable) {
                    navigateToStep(stepKey);
                  }
                }}
                disabled={!isNavigable}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                    : isNavigable
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>{step.icon}</span>
                <span className="hidden md:inline font-medium">{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`w-8 md:w-16 h-0.5 mx-1 ${
                    idx < currentIndex ? 'bg-green-300' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            {appMode === 'standup' ? 'Async Standup AI' : 'Performance Review AI'}
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-4">
            {appMode === 'standup'
              ? 'Generate professional async standup updates powered by AI, based on your actual contributions'
              : 'Generate compelling performance review answers powered by AI, based on your actual contributions'}
          </p>
          {/* Donation Buttons */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <a
              href="https://ko-fi.com/tommasini"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF5E5B] text-white rounded-lg hover:bg-[#ff4744] transition-colors font-medium text-sm shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
              </svg>
              Buy me a coffee ☕
            </a>
            <a
              href="https://github.com/sponsors/tommasini"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#24292e] text-white rounded-lg hover:bg-[#1a1e22] transition-colors font-medium text-sm shadow-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sponsor
            </a>
          </div>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="space-y-6">
          {currentStep === 'setup' && (
            <>
              {sessionRestored && !sessionDismissed && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">⚡</span>
                    <span className="font-medium flex-shrink-0">Welcome back!</span>
                    <span className="text-teal-700 truncate">Your previous session has been restored — just click through and generate.</span>
                  </div>
                  <button
                    onClick={() => setSessionDismissed(true)}
                    className="flex-shrink-0 text-teal-500 hover:text-teal-700 transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <ProfileSetup
                profile={profile}
                setProfile={setProfile}
                dataSources={dataSources}
                setDataSources={setDataSources}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
              />

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-700 mb-4 text-center">
                  What would you like to generate?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSelectMode('performance-review')}
                    disabled={!canProceedFromSetup()}
                    className="group flex flex-col items-start gap-2 px-5 py-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-100 disabled:bg-gray-50 disabled:border-gray-200 disabled:cursor-not-allowed transition-all text-left"
                  >
                    <div className="flex items-center gap-2 font-semibold text-blue-700 group-disabled:text-gray-400">
                      <span className="text-xl">✍️</span>
                      Performance Review
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-blue-600 group-disabled:text-gray-400">
                      Answer performance review questions with AI-generated, evidence-based responses from your contributions.
                    </p>
                  </button>

                  <button
                    onClick={() => handleSelectMode('standup')}
                    disabled={!canProceedFromSetup()}
                    className="group flex flex-col items-start gap-2 px-5 py-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-100 disabled:bg-gray-50 disabled:border-gray-200 disabled:cursor-not-allowed transition-all text-left"
                  >
                    <div className="flex items-center gap-2 font-semibold text-indigo-700 group-disabled:text-gray-400">
                      <span className="text-xl">📋</span>
                      Async Standup
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-indigo-600 group-disabled:text-gray-400">
                      Generate a daily or weekly async standup update with status, risks, next steps, and PRs needing attention.
                    </p>
                  </button>
                </div>
                {!canProceedFromSetup() && (
                  <p className="mt-3 text-xs text-center text-amber-600">
                    Complete your profile, date range, and at least one data source above to continue.
                  </p>
                )}
              </div>
            </>
          )}

          {currentStep === 'questions' && (
            <>
              <QuestionsInput
                customQuestions={customQuestions}
                setCustomQuestions={setCustomQuestions}
                companyValues={companyValues}
                setCompanyValues={setCompanyValues}
                additionalContext={additionalContext}
                setAdditionalContext={setAdditionalContext}
                claudeApiKey={claudeApiKey}
                setClaudeApiKey={setClaudeApiKey}
              />
              
              <div className="flex justify-between">
                <button
                  onClick={() => navigateToStep('setup')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <div className="flex gap-2">
                  {data && (
                    <button
                      onClick={() => navigateToStep(finalStep)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                    >
                      Go to Review
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => navigateToStep('fetch')}
                    disabled={!canProceedToFetch()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    {data ? 'Update Contributions' : 'Continue to Contributions'}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {currentStep === 'standup-config' && (
            <>
              <StandupConfigComponent
                standupConfig={standupConfig}
                setStandupConfig={setStandupConfig}
                claudeApiKey={claudeApiKey}
                setClaudeApiKey={setClaudeApiKey}
              />

              <div className="flex justify-between">
                <button
                  onClick={() => navigateToStep('setup')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <div className="flex gap-2">
                  {data && (
                    <button
                      onClick={() => navigateToStep(finalStep)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                    >
                      Go to Output
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => navigateToStep('fetch')}
                    disabled={!canProceedToFetch()}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                  >
                    {data ? 'Update Contributions' : 'Continue to Contributions'}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {currentStep === 'fetch' && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {/* Mode Toggle */}
                <div className="flex justify-center mb-6">
                  <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                    <button
                      onClick={() => setInputMode('fetch')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        inputMode === 'fetch'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Fetch from APIs
                      </span>
                    </button>
                    <button
                      onClick={() => setInputMode('manual')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        inputMode === 'manual'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Manual Input
                      </span>
                    </button>
                  </div>
                </div>

                {/* Fetch Mode Content */}
                {inputMode === 'fetch' && (
                  <div className="text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Ready to Fetch Your Contributions
                    </h2>
                    <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                      We&apos;ll fetch your pull requests, issues, reviews, and commits from {dataSources.filter(ds => ds.enabled).map(ds => ds.type).join(', ') || 'configured sources'} for the period {startDate} to {endDate}.
                    </p>

                    {error && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-left">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={fetchData}
                      disabled={loading || !dataSources.some(ds => ds.enabled && ds.username)}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg flex items-center gap-3 mx-auto"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Fetching... (This may take 1-3 minutes)</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Fetch My Contributions</span>
                        </>
                      )}
                    </button>

                    {!dataSources.some(ds => ds.enabled && ds.username) && (
                      <p className="mt-4 text-sm text-amber-600">
                        Please configure at least one data source in the Setup step, or use Manual Input mode.
                      </p>
                    )}

                    {loading && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                        <p className="text-sm text-blue-800 font-medium mb-2">
                          Fetching your contributions...
                        </p>
                        <p className="text-xs text-blue-700">
                          We&apos;re searching for your activity across repositories. Using a personal access token can speed this up significantly.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode Content */}
                {inputMode === 'manual' && (
                  <div>
                    <div className="text-center mb-6">
                      <div className="text-6xl mb-4">✍️</div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Enter Your Contributions Manually
                      </h2>
                      <p className="text-gray-600 max-w-lg mx-auto">
                        Privacy-first option: describe your contributions without connecting to any APIs. 
                        The AI will use this text to generate your review answers.
                      </p>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Your Contributions
                        </label>
                        <button
                          onClick={() => setManualInput(MANUAL_INPUT_EXAMPLE)}
                          className="text-xs text-purple-600 hover:text-purple-700 hover:underline"
                        >
                          Load example template
                        </button>
                      </div>
                      <textarea
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        rows={15}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                        placeholder={`Describe your contributions. You can use markdown format:

# My Contributions

## Pull Requests
- Implemented feature X (merged)
- Fixed bug Y (merged)

## Code Reviews
- Reviewed N pull requests

## Key Achievements
- Reduced latency by X%
- Led project Z`}
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Tip: Use headers (## Section) and bullet points (- item) for best results. The AI will extract and summarize your contributions.
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                      </div>
                    )}

                    <div className="flex justify-center">
                      <button
                        onClick={processManualInput}
                        disabled={!manualInput.trim()}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg flex items-center gap-3"
                      >
                        <span>✨</span>
                        <span>Use These Contributions</span>
                      </button>
                    </div>

                    <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🔒</span>
                        <div className="text-sm text-purple-800">
                          <p className="font-medium">Privacy-First Mode</p>
                          <p className="text-purple-700 mt-1">
                            Your contributions are processed locally and sent directly to the AI. No APIs are called, no data is fetched from external services.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => navigateToStep(secondStep)}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                {data && !loading && (
                  <button
                    onClick={() => navigateToStep(finalStep)}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                  >
                    {appMode === 'standup' ? 'Go to Output' : 'Go to Review'}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}

          {currentStep === 'review' && data && (
            <>
              <ContributionsView data={data} />
              <ReviewForm
                data={data}
                profile={profile}
                customQuestions={customQuestions}
                companyValues={companyValues}
                additionalContext={additionalContext}
                claudeApiKey={claudeApiKey}
                setClaudeApiKey={setClaudeApiKey}
              />
              
              <div className="flex justify-between">
                <button
                  onClick={() => navigateToStep('fetch')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Refetch Data
                </button>
              </div>
            </>
          )}

          {currentStep === 'standup-review' && data && (
            <>
              <StandupReview
                data={data}
                profile={profile}
                standupConfig={standupConfig}
                claudeApiKey={claudeApiKey}
                setClaudeApiKey={setClaudeApiKey}
              />

              <div className="flex justify-between">
                <button
                  onClick={() => navigateToStep('fetch')}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Refetch Data
                </button>
              </div>
            </>
          )}
        </div>

        {/* Donations - More prominent after completing review */}
        <div className="mt-12">
          <Donations showAfterReview={currentStep === 'review' || currentStep === 'standup-review'} />
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>
            Built with ❤️ to help engineers showcase their impact.
            <br />
            <span className="text-xs">
              Your data never leaves your browser except to fetch from APIs you configure.
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}
