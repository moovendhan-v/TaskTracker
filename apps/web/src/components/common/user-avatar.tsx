import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/initials';

interface UserAvatarProps {
  name: string;
  className?: string;
  showTooltip?: boolean;
}

export function UserAvatar({ name, className, showTooltip = false }: UserAvatarProps) {
  const avatar = (
    <Avatar className={cn(className)}>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
  return showTooltip ? <Tooltip label={name}>{avatar}</Tooltip> : avatar;
}
