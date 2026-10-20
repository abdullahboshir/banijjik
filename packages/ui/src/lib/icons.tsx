import {
  Bell,
  Calendar,
  ChartColumn,
  Circle,
  ClipboardList,
  GraduationCap,
  Globe,
  House,
  Inbox,
  List,
  Menu,
  Package,
  Palette,
  Plus,
  Receipt,
  Search,
  Settings,
  SlidersHorizontal,
  Store,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Users,
  Wallet,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";

/**
 * Menu `iconKey` values are lucide icon names (docs/12). Only icons the shell and the menu
 * groups use are registered, so unused icons stay out of the bundle. Add a line when a card needs one.
 */
const ICONS_BY_KEY: Readonly<Record<string, LucideIcon>> = {
  bell: Bell,
  calendar: Calendar,
  "chart-column": ChartColumn,
  "clipboard-list": ClipboardList,
  "graduation-cap": GraduationCap,
  globe: Globe,
  house: House,
  inbox: Inbox,
  list: List,
  menu: Menu,
  package: Package,
  palette: Palette,
  plus: Plus,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  "sliders-horizontal": SlidersHorizontal,
  store: Store,
  "shopping-cart": ShoppingCart,
  tag: Tag,
  truck: Truck,
  user: User,
  users: Users,
  wallet: Wallet,
  zap: Zap,
  x: X,
};

interface IconProps {
  iconKey: string;
  className?: string;
}

export function resolveIcon(iconKey: string): LucideIcon {
  return ICONS_BY_KEY[iconKey] ?? Circle;
}

export function Icon({ iconKey, className }: IconProps): ReactElement {
  const Component = resolveIcon(iconKey);
  return <Component aria-hidden="true" className={className} />;
}
