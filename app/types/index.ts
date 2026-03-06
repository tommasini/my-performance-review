// User Profile Types
export interface UserProfile {
  currentPosition: string;
  targetPosition: string;
  yearsInRole?: number;
  companyName: string;
}

// Review Configuration
export interface ReviewConfig {
  startDate: string;
  endDate: string;
  companyValues?: string;
  customQuestions: string;
  additionalContext?: string;
}

// Data Source Types
export type DataSourceType = 'github' | 'gitlab' | 'bitbucket' | 'jira';

export interface DataSourceConfig {
  type: DataSourceType;
  enabled: boolean;
  username: string;
  organization?: string;
  token?: string;
  baseUrl?: string; // For self-hosted instances
}

// Contribution Types
export interface PullRequest {
  title: string;
  number: number;
  state: string;
  url: string;
  createdAt: string;
  mergedAt: string | null;
  repo: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  source: DataSourceType;
}

export interface Issue {
  title: string;
  number: number;
  state: string;
  url: string;
  createdAt: string;
  repo: string;
  comments: number;
  source: DataSourceType;
}

export interface Review {
  state: string;
  body: string | null;
  url: string;
  createdAt: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  source: DataSourceType;
}

export interface Commit {
  sha: string;
  message: string;
  url: string;
  createdAt: string | undefined;
  repo: string;
  source: DataSourceType;
}

export interface Ticket {
  key: string;
  title: string;
  status: string;
  url: string;
  createdAt: string;
  resolvedAt?: string;
  type: string; // bug, story, task, etc.
  source: DataSourceType;
}

export interface ContributionData {
  pullRequests: PullRequest[];
  issues: Issue[];
  reviews: Review[];
  commits: Commit[];
  tickets: Ticket[];
}

export interface ContributionStats {
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  closedPRs: number;
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  totalReviews: number;
  approvedReviews: number;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  reposContributed: number;
  totalTickets: number;
  resolvedTickets: number;
}

export interface FetchedData {
  contributions: ContributionData;
  stats: ContributionStats;
  dateRange: { start: string; end: string };
  sources: DataSourceType[];
}

// Parsed Question
export interface ParsedQuestion {
  id: string;
  text: string;
  answer?: string;
  aiSuggestion?: string;
  isLoading?: boolean;
}

// AI Response
export interface AIResponse {
  answer: string;
  provider: 'claude' | 'openai' | 'deepseek';
  notice?: string;
}

// Rate Limit Response
export interface RateLimitInfo {
  remaining: number;
  resetAt: number;
  isLimited: boolean;
}

// Standup Types
export type AppMode = 'performance-review' | 'standup';
export type StandupFrequency = 'daily' | 'weekly';
export type StandupStatus = 'on-track' | 'at-risk' | 'off-track';

export interface StandupConfig {
  frequency: StandupFrequency;
  milestone?: string;
  epicLink?: string;
  originalTargetDate?: string;
  targetDate?: string;
  customFormat?: string; // overrides the default template when provided
}

export interface StandupOutput {
  status: StandupStatus;
  keyUpdates: string;
  nextSteps: string;
  prsNeedingAttention: string;
}

