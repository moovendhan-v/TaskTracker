import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/initials';

interface UserAvatarProps {
  name: string;
  className?: string;
  showTooltip?: boolean;
}

/** Avatar backgrounds, dark enough for white initials in both themes. */
const AVATAR_COLORS = ['#2563eb', '#c2410c', '#0f766e', '#a16207', '#be185d', '#15803d', '#6d28d9', '#b91c1c', '#0369a1', '#7c3aed'];

/** The same person always gets the same colour, wherever they appear. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}

export function UserAvatar({ name, className, showTooltip = false }: UserAvatarProps) {
  const avatar = (
    <Avatar className={cn(className)}>
      <AvatarFallback className="text-white" style={{ backgroundColor: avatarColor(name) }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
  return showTooltip ? <Tooltip label={name}>{avatar}</Tooltip> : avatar;
}
