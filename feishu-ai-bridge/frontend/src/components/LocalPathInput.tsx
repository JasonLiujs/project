interface LocalPathInputProps {
  value: string;
  onChange: (path: string) => void;
}

export default function LocalPathInput({ value, onChange }: LocalPathInputProps) {
  return (
    <input
      type="text"
      className="input input-bordered w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="/Users/username/projects/my-repo"
    />
  );
}
