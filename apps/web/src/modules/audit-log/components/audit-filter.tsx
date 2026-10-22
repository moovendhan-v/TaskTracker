import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AuditFilterProps {
  value: string;
  onChange: (value: string) => void;
}

/** Action-prefix filter, limited to the characters the API accepts. */
export function AuditFilter({ value, onChange }: AuditFilterProps) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase().replace(/[^a-z_.]/g, ''))}
        placeholder="Filter by action, e.g. hr."
        aria-label="Filter by action"
        maxLength={80}
        className="h-8 w-60 pl-8 font-mono"
      />
    </div>
  );
}
