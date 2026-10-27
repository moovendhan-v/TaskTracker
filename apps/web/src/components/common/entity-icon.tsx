import {
  BookIcon,
  BoxIcon,
  BriefcaseIcon,
  BugIcon,
  Building2Icon,
  CalendarIcon,
  CameraIcon,
  ChartColumnIcon,
  ChartPieIcon,
  ClockIcon,
  CloudIcon,
  CodeIcon,
  CoffeeIcon,
  CompassIcon,
  DatabaseIcon,
  FileIcon,
  FlagIcon,
  FolderIcon,
  GiftIcon,
  GlobeIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HeadsetIcon,
  HeartIcon,
  HouseIcon,
  ImageIcon,
  LeafIcon,
  LightbulbIcon,
  ListIcon,
  LockIcon,
  MailIcon,
  MapIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  MoonIcon,
  MusicIcon,
  NotebookPenIcon,
  PaletteIcon,
  PenLineIcon,
  PhoneIcon,
  PuzzleIcon,
  RocketIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
  SunIcon,
  TargetIcon,
  TerminalIcon,
  TrendingUpIcon,
  TrophyIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';
import type { IconKey } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';

/** The drawing for each icon key the API accepts. */
export const ICONS: Record<IconKey, LucideIcon> = {
  folder: FolderIcon,
  list: ListIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  flag: FlagIcon,
  star: StarIcon,
  heart: HeartIcon,
  zap: ZapIcon,
  bug: BugIcon,
  code: CodeIcon,
  terminal: TerminalIcon,
  database: DatabaseIcon,
  server: ServerIcon,
  cloud: CloudIcon,
  shield: ShieldIcon,
  lock: LockIcon,
  megaphone: MegaphoneIcon,
  mail: MailIcon,
  message: MessageSquareIcon,
  phone: PhoneIcon,
  palette: PaletteIcon,
  pen: PenLineIcon,
  image: ImageIcon,
  camera: CameraIcon,
  video: VideoIcon,
  music: MusicIcon,
  book: BookIcon,
  file: FileIcon,
  notebook: NotebookPenIcon,
  graduation: GraduationCapIcon,
  briefcase: BriefcaseIcon,
  building: Building2Icon,
  store: StoreIcon,
  cart: ShoppingCartIcon,
  wallet: WalletIcon,
  chart: ChartColumnIcon,
  pie: ChartPieIcon,
  trending: TrendingUpIcon,
  calendar: CalendarIcon,
  clock: ClockIcon,
  users: UsersIcon,
  user: UserIcon,
  handshake: HandshakeIcon,
  headset: HeadsetIcon,
  globe: GlobeIcon,
  map: MapIcon,
  compass: CompassIcon,
  home: HouseIcon,
  lightbulb: LightbulbIcon,
  puzzle: PuzzleIcon,
  wrench: WrenchIcon,
  settings: SettingsIcon,
  box: BoxIcon,
  truck: TruckIcon,
  leaf: LeafIcon,
  sun: SunIcon,
  moon: MoonIcon,
  coffee: CoffeeIcon,
  gift: GiftIcon,
  trophy: TrophyIcon,
};

interface EntityIconProps {
  icon: IconKey | null | undefined;
  /** Tints the icon (or fills the badge); falls back to the current text colour. */
  color?: string | null;
  /** Drawn when there's no icon: the first letter on a coloured square (spaces), or this icon. */
  fallback?: { letter: string } | LucideIcon;
  /** `badge` puts the icon on a coloured square, like a space's avatar. */
  variant?: 'plain' | 'badge';
  className?: string;
}

/** The icon of a space, folder, list or doc. */
export function EntityIcon({ icon, color, fallback = ListIcon, variant = 'plain', className }: EntityIconProps) {
  const Icon = icon ? ICONS[icon] : typeof fallback === 'object' && 'letter' in fallback ? null : (fallback as LucideIcon);

  if (variant === 'badge') {
    return (
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white', className)} style={{ backgroundColor: color ?? undefined }} aria-hidden>
        {Icon ? <Icon className="size-3.5" /> : typeof fallback === 'object' && 'letter' in fallback ? fallback.letter.slice(0, 1).toUpperCase() : null}
      </span>
    );
  }
  if (!Icon) return null;
  return <Icon className={cn('size-4 shrink-0', className)} style={color ? { color } : undefined} aria-hidden />;
}
