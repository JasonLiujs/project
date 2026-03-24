export interface RepoConfig {
  id: string;
  type: 'github' | 'gitlab' | 'local';
  url?: string;
  localPath?: string;
  isDefault: boolean;
  workItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  branchCount?: number;
  lastCommit?: string;
}

export type RepoType = 'github' | 'gitlab' | 'local';
