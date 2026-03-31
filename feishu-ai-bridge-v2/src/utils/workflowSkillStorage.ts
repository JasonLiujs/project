export interface WorkflowSkillConfigItem {
  nodeId: string;
  skill: string;
}

export interface WorkflowSkillScope {
  spaceId?: string;
  workObjectId?: string;
  workItemId?: string;
}

const GLOBAL_WORKFLOW_SKILL_CONFIGS_KEY = 'workflow-skill-configs';

export function getWorkflowSkillConfigsStorageKey(scope?: WorkflowSkillScope): string {
  const parts = [scope?.spaceId, scope?.workObjectId, scope?.workItemId]
    .map((item) => (item || '').trim())
    .filter(Boolean);

  if (parts.length === 3) {
    return `${GLOBAL_WORKFLOW_SKILL_CONFIGS_KEY}:${parts.join(':')}`;
  }

  return GLOBAL_WORKFLOW_SKILL_CONFIGS_KEY;
}

export function loadWorkflowSkillConfigs(scope?: WorkflowSkillScope): WorkflowSkillConfigItem[] {
  try {
    const storageKey = getWorkflowSkillConfigsStorageKey(scope);
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }

    const configs = JSON.parse(stored);
    return Array.isArray(configs) ? configs : [];
  } catch (error) {
    console.warn('[workflowSkillStorage] Failed to load configs:', error);
    return [];
  }
}

export function saveWorkflowSkillConfigs(
  configs: WorkflowSkillConfigItem[],
  scope?: WorkflowSkillScope
): void {
  const storageKey = getWorkflowSkillConfigsStorageKey(scope);
  localStorage.setItem(storageKey, JSON.stringify(configs));
}
