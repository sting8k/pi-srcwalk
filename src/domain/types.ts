export type Intent = "overview" | "callers" | "callees" | "deps" | "impact" | "definition" | "test" | "related" | "general";
export type QueryKind = "explicit_target" | "overview" | "file" | "file_deps" | "intent_symbol" | "test" | "symbol" | "general";
export type ParseMode = "discover" | "context" | "show" | "deps" | "overview" | "trace" | "bm25" | "assess" | "review";
export type DetailLevel = "brief" | "normal" | "deep";

export interface SrcwalkCommand {
  label: string;
  args: string[];
  purpose: string;
  parseAs: ParseMode;
}

export interface QueryPlan {
  query: string;
  repo: string;
  scope: string;
  intent: Intent;
  queryKind: QueryKind;
  keywords: string[];
  commands: SrcwalkCommand[];
  maxResults: number;
  detail: DetailLevel;
  shouldTraceCallers: boolean;
  shouldTraceCallees: boolean;
  shouldGetDeps: boolean;
  shouldAssess: boolean;
}

export interface CommandResult {
  command: SrcwalkCommand;
  output: string;
  code: number;
  elapsedMs: number;
  matchCount?: number;
}

export interface Candidate {
  target: string;
  source: string;
  commandLabel: string;
  kind: string;
  symbol?: string;
  score: number;
  evidence: string[];
}

export interface ConfidenceReport {
  abstained: boolean;
  level: "low" | "medium" | "high";
  reason: string;
  topScore: number;
  topGap: number;
  topFileCluster: number;
  pathKeywordCoverage: number;
}

export interface SearchResult {
  plan: QueryPlan;
  commandResults: CommandResult[];
  candidates: Candidate[];
  expansions: CommandResult[];
  notes: string[];
  confidence: ConfidenceReport;
  cache?: CacheStats;
}

export interface CacheStats {
  cacheKind: "memory";
  cacheLocation: string;
  cacheHit: boolean;
  chunks: number;
  files: number;
  fingerprint: string;
  buildMs: number;
  queryMs: number;
  sizeBytes: number;
}

export interface CompactPostings {
  offsets: Uint32Array;
  docs: Uint32Array;
  freqs: Uint16Array;
}

export interface CompactDocTerms {
  offsets: Uint32Array;
  termIds: Uint32Array;
  freqs: Uint16Array;
}

export interface LexicalIndex {
  chunkCount: number;
  paths: string[];
  chunkPathIds: Uint32Array;
  chunkStarts: Uint32Array;
  chunkEnds: Uint32Array;
  chunkPreviews: string[];
  vocab: string[];
  termIds: Map<string, number>;
  docFreq: Uint32Array;
  docLens: Uint32Array;
  postings: CompactPostings;
  docTerms: CompactDocTerms;
  avgdl: number;
  stats: CacheStats;
}
