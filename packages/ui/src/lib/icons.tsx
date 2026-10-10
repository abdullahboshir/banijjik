import {
  Bell,
  Calendar,
  ChartColumn,
  Circle,
  GraduationCap,
  Globe,
  House,
  Inbox,
  Menu,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Users,
  Wallet,
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
  "graduation-cap": GraduationCap,
  globe: Globe,
  house: House,
  inbox: Inbox,
  menu: Menu,
  package: Package,
  plus: Plus,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  "shopping-cart": ShoppingCart,
  tag: Tag,
  truck: Truck,
  user: User,
  users: Users,
  wallet: Wallet,
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
