import { RepoType } from '../types';

interface RemoteUrlInputProps {
  type: RepoType;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export default function RemoteUrlInput({ type, value, onChange, placeholder }: RemoteUrlInputProps) {
  const defaultPlaceholder = type === 'github'
    ? 'https://github.com/username/repo'
    : 'https://gitlab.com/username/repo';

  return (
    <input
      type="url"
      className="input input-bordered w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || defaultPlaceholder}
    />
  );
}
