import type { RoleResponse } from '@taskflow/shared-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RoleSelectProps {
  id?: string;
  roles: RoleResponse[];
  value: string;
  onChange: (roleId: string) => void;
  disabled?: boolean;
}

export function RoleSelect({ id, roles, value, onChange, disabled }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-8 w-40" aria-label="Role">
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
