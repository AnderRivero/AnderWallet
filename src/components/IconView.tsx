import {
  Baby,
  Banknote,
  Bitcoin,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Car,
  Cloud,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Tv,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { Icon } from '../lib/types'

export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Landmark,
  Wallet,
  Bitcoin,
  CreditCard,
  PiggyBank,
  Banknote,
  Coins,
  HandCoins,
  Briefcase,
  Building2,
  Store,
  ShoppingCart,
  Utensils,
  Coffee,
  House,
  Zap,
  Droplet,
  Flame,
  Wifi,
  Phone,
  Smartphone,
  Laptop,
  Cloud,
  Tv,
  Film,
  Music,
  Gamepad2,
  Car,
  Fuel,
  Bus,
  Plane,
  HeartPulse,
  Pill,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Shirt,
  Scissors,
  Gift,
  Baby,
  Dog,
  Users,
  Wrench,
  Receipt,
  Repeat,
  Sparkles,
  Tag,
}

export function brandUrl(value: string, color = 'ffffff'): string {
  const [prefix, name] = value.split(':')
  const tint = prefix === 'simple-icons' ? `?color=%23${color}` : ''
  return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg${tint}`
}

export function IconView({ icon, color, size = 40 }: { icon: Icon; color: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const inner = Math.round(size * 0.52)
  const style = { width: size, height: size, background: `${color}26`, color, borderColor: `${color}55` }

  if (icon.kind === 'lucide' || broken) {
    const Component = LUCIDE_ICONS[icon.value] ?? Tag
    return (
      <span className="icon-tile" style={style} aria-hidden="true">
        <Component size={inner} />
      </span>
    )
  }

  const src = icon.kind === 'brand' ? brandUrl(icon.value, color.replace('#', '')) : icon.value
  return (
    <span className="icon-tile" style={style} aria-hidden="true">
      <img
        src={src}
        alt=""
        width={inner}
        height={inner}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </span>
  )
}
