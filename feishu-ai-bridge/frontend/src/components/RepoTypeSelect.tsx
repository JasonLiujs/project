import { RepoType } from '../types';

interface RepoTypeSelectProps {
  value: RepoType;
  onChange: (type: RepoType) => void;
}

export default function RepoTypeSelect({ value, onChange }: RepoTypeSelectProps) {
  return (
    <select
      className="select select-bordered select-primary w-full max-w-xs"
      value={value}
      onChange={(e) => onChange(e.target.value as RepoType)}
    >
      <option value="github">🐙 GitHub</option>
      <option value="gitlab">🦊 GitLab</option>
      <option value="local">📁 本地仓库</option>
    </select>
  );
}
