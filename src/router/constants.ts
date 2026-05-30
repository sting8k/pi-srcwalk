export const WEAK_KEYWORDS = new Set([
  "find", "show", "get", "make", "create", "build", "see", "look", "check",
  "view", "display", "code", "file", "function", "class", "method", "thing",
  "stuff", "logic", "work", "works", "explain", "tell", "me", "please",
]);

export const STOP_WORDS = new Set([
  "how", "does", "the", "a", "an", "is", "are", "what", "where", "who", "when",
  "why", "this", "that", "it", "of", "for", "to", "in", "on", "at", "by", "with",
  "from", "and", "or", "as", "into", "about", "inside", "around",
]);

export const INTENT_TERMS = new Set([
  "overview", "architecture", "structure", "map", "where", "call", "calls", "called",
  "caller", "callers", "callee", "callees", "deps", "dependency", "dependencies",
  "imports", "impact", "defined", "definition", "implement", "implementation", "implemented",
  "test", "tests", "spec", "example", "examples", "fixture", "result", "results",
  "related", "similar",
]);

export const CODE_EXTS = new Set([
  ".rs", ".go", ".cs", ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".kt",
  ".swift", ".cpp", ".cc", ".c", ".h", ".hpp", ".rb", ".php", ".scala",
  ".css", ".scss", ".less", ".html",
]);

export const DOC_EXTS = new Set([".md", ".mdx", ".rst", ".toml", ".yaml", ".yml", ".json"]);
export const INDEX_EXTS = new Set([...CODE_EXTS, ...DOC_EXTS]);
