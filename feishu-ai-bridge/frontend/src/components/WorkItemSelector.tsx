interface WorkItemSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export default function WorkItemSelector({ value, onChange }: WorkItemSelectorProps) {
  return (
    <div className="flex gap-3 items-center">
      <input
        type="text"
        className="input input-bordered flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入工作项 ID 或名称"
      />
      <button type="button" className="btn btn-outline btn-sm">
        🔍 搜索
      </button>
    </div>
  );
}
