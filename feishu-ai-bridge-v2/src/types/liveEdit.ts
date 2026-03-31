export interface LiveEditSnippet {
  language?: string;
  code: string;
  isComplete: boolean;
}

export interface LiveEditFileChange {
  filePath: string;
  symbol?: string;
  line?: number;
  changedLines?: number[];
  timestamp: number;
}

export interface LiveEditChangeSummary {
  requestId?: string;
  sessionId?: string;
  source: 'fs-watch';
  fileCount: number;
  files: LiveEditFileChange[];
  timestamp: number;
}

export interface LiveEditEvent {
  filePath: string;
  symbol?: string;
  line?: number;
  changedLines?: number[];
  snippet?: LiveEditSnippet;
  requestIds?: string[];
  sessionIds?: string[];
  source: 'fs-watch';
  reason?: string;
  timestamp: number;
}
