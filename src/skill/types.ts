export interface LoadedSkill {
  root: string;
  entrypoint: string;
  name: string | null;
  frontmatter: Record<string, unknown>;
  markdown: string;
}

export interface ResolvedReference {
  source: string;
  raw: string;
  resolvedPath: string;
  exists: boolean;
  escapedRoot: boolean;
  cyclic: boolean;
}

export interface StaticAnalysis {
  skillName: string | null;
  references: string[];
  urls: string[];
  commands: string[];
  scripts: string[];
  brokenReferences: string[];
  behaviorDeclarations?: {
    file_read: string[];
    file_write: string[];
    process_execution: string[];
    network_request: string[];
  };
  declarationConfidence: "declared" | "indeterminate";
}
