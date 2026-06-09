const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  c: "c",
  cc: "cpp",
  cjs: "js",
  conf: "ini",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cts: "ts",
  cxx: "cpp",
  go: "go",
  h: "c",
  hpp: "cpp",
  htm: "html",
  html: "html",
  hxx: "cpp",
  ini: "ini",
  java: "java",
  js: "js",
  json: "json",
  jsonc: "jsonc",
  jsx: "jsx",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  markdown: "markdown",
  md: "markdown",
  mdx: "mdx",
  mjs: "js",
  mts: "ts",
  php: "php",
  py: "python",
  pyw: "python",
  rb: "ruby",
  rs: "rust",
  sass: "sass",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  swift: "swift",
  toml: "toml",
  ts: "ts",
  tsx: "tsx",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml"
};

const LANGUAGE_BY_BASENAME: Record<string, string> = {
  Dockerfile: "dockerfile",
};

function targetParts(target: string | string[]): string[] {
  const targets = Array.isArray(target) ? target : [target];
  return targets.flatMap((part) => part.split(",").map((item) => item.trim()).filter(Boolean));
}

function pathFromTarget(target: string): string {
  const withoutSuffix = target
    .split(/[?#]/, 1)[0]!
    .replace(/:\d+(?:-\d+)?(?::\d+)?$/, "");
  return withoutSuffix.split(/\s+/, 1)[0] ?? "";
}

function languageFromPath(pathLike: string): string | undefined {
  const pathOnly = pathFromTarget(pathLike);
  const basename = pathOnly.split(/[\\/]/).pop() ?? pathOnly;
  const basenameLanguage = LANGUAGE_BY_BASENAME[basename];
  if (basenameLanguage) return basenameLanguage;

  const match = basename.match(/\.([^.]+)$/);
  const extension = match?.[1]?.toLowerCase();
  return extension ? LANGUAGE_BY_EXTENSION[extension] : undefined;
}

export function codeFenceLanguage(target?: string | string[]): string {
  if (!target) return "text";
  const languages = new Set<string>();
  for (const part of targetParts(target)) {
    const language = languageFromPath(part);
    if (!language) return "text";
    languages.add(language);
  }
  return languages.size === 1 ? [...languages][0]! : "text";
}

function markdownFenceFor(content: string): string {
  const longest = Math.max(2, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  return "`".repeat(longest + 1);
}

export function fencedCodeBlock(content: string, target?: string | string[]): string[] {
  const fence = markdownFenceFor(content);
  return [`${fence}${codeFenceLanguage(target)}`, content, fence];
}
