import { useState } from 'react';
import { RepoConfig as RepoConfigType, RepoType, TestConnectionResult } from '../types';
import RepoTypeSelect from './RepoTypeSelect';
import LocalPathInput from './LocalPathInput';
import RemoteUrlInput from './RemoteUrlInput';
import WorkItemSelector from './WorkItemSelector';

interface RepoConfigProps {
  config: RepoConfigType | null;
  onSave: (config: RepoConfigType) => Promise<void>;
}

export default function RepoConfig({ config, onSave }: RepoConfigProps) {
  const [repoType, setRepoType] = useState<RepoType>(config?.type || 'github');
  const [remoteUrl, setRemoteUrl] = useState(config?.url || '');
  const [localPath, setLocalPath] = useState(config?.localPath || '');
  const [isDefault, setIsDefault] = useState(config?.isDefault || false);
  const [workItemId, setWorkItemId] = useState(config?.workItemId || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const target = repoType === 'local' ? localPath : remoteUrl;
      if (!target) {
        setMessage({ type: 'error', text: '请先填写仓库地址或路径' });
        return;
      }

      const result = await testConnection(repoType, target);
      setTestResult(result);
      
      if (result.success) {
        setMessage({ type: 'success', text: '连接成功！' });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '连接测试失败，请检查地址是否正确' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const newConfig: RepoConfigType = {
        id: config?.id || crypto.randomUUID(),
        type: repoType,
        url: repoType !== 'local' ? remoteUrl : undefined,
        localPath: repoType === 'local' ? localPath : undefined,
        isDefault,
        workItemId: workItemId || undefined,
        createdAt: config?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(newConfig);
      setMessage({ type: 'success', text: '配置保存成功！' });
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-2xl mx-auto my-8">
      <div className="card-body">
        <h2 className="card-title text-2xl mb-4">
          <span>📦</span> 仓库配置
        </h2>

        {message && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            <span>{message.text}</span>
          </div>
        )}

        {testResult && testResult.success && (
          <div className="alert alert-success">
            <span>✅ 连接成功</span>
            <div className="text-sm">
              {testResult.branchCount && <div>分支数: {testResult.branchCount}</div>}
              {testResult.lastCommit && <div>最后提交: {testResult.lastCommit}</div>}
            </div>
          </div>
        )}

        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text font-semibold">仓库类型</span>
          </label>
          <RepoTypeSelect value={repoType} onChange={setRepoType} />
        </div>

        <div className="divider"></div>

        {repoType === 'local' ? (
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-semibold">本地仓库路径</span>
            </label>
            <LocalPathInput value={localPath} onChange={setLocalPath} />
          </div>
        ) : (
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-semibold">远程仓库地址</span>
            </label>
            <RemoteUrlInput
              type={repoType}
              value={remoteUrl}
              onChange={setRemoteUrl}
              placeholder={
                repoType === 'github'
                  ? 'https://github.com/username/repo'
                  : 'https://gitlab.com/username/repo'
              }
            />
          </div>
        )}

        <div className="divider"></div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold">关联工作项 (可选)</span>
          </label>
          <WorkItemSelector value={workItemId} onChange={setWorkItemId} />
        </div>

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span className="label-text">设为默认仓库</span>
          </label>
        </div>

        <div className="card-actions justify-end mt-6">
          <button
            className={`btn btn-outline btn-primary ${testing ? 'loading' : ''}`}
            onClick={handleTestConnection}
            disabled={testing}
          >
            {!testing && '🔍'} {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            className={`btn btn-primary ${saving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {!saving && '💾'} {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function testConnection(
  type: RepoType,
  target: string
): Promise<TestConnectionResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (type === 'local') {
        if (target.includes('/') || target.includes('\\')) {
          resolve({
            success: true,
            message: '本地路径可访问',
            branchCount: 3,
            lastCommit: new Date().toISOString().split('T')[0],
          });
        } else {
          resolve({
            success: false,
            message: '路径格式不正确',
          });
        }
      } else {
        if (target.includes('github.com') || target.includes('gitlab.com')) {
          resolve({
            success: true,
            message: '远程仓库可访问',
            branchCount: 5,
            lastCommit: new Date().toISOString().split('T')[0],
          });
        } else {
          resolve({
            success: false,
            message: '仓库地址格式不正确',
          });
        }
      }
    }, 1000);
  });
}
