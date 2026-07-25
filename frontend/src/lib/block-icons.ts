// Curated icon set for Feature Grid / Trust Badge blocks — a merchant picks
// a name from a dropdown, never writes an SVG or class name themselves.
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Headphones,
  Heart,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Star,
  ThumbsUp,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const BLOCK_ICON_MAP: Record<string, LucideIcon> = {
  award: Award,
  "badge-check": BadgeCheck,
  "check-circle": CheckCircle2,
  clock: Clock,
  "credit-card": CreditCard,
  gift: Gift,
  headphones: Headphones,
  heart: Heart,
  mail: Mail,
  "map-pin": MapPin,
  package: Package,
  phone: Phone,
  "shield-check": ShieldCheck,
  star: Star,
  "thumbs-up": ThumbsUp,
  truck: Truck,
  zap: Zap,
};

export const BLOCK_ICON_NAMES = Object.keys(BLOCK_ICON_MAP);

export function resolveBlockIcon(name: string | null | undefined): LucideIcon {
  return BLOCK_ICON_MAP[name ?? ""] ?? Star;
}
