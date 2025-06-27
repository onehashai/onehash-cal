"use client";

import {
  Calendar,
  Clock,
  AlarmClock,
  User,
  Users,
  Phone,
  Video,
  Mic,
  Mail,
  MapPin,
  Globe,
  Briefcase,
  Handshake,
  BookOpen,
  Presentation,
  Lightbulb,
  PenTool,
  Monitor,
  Settings,
  CheckCircle,
  Star,
  Heart,
  Play,
  Tag,
  Share2,
  Repeat,
  RefreshCcw,
  RotateCcw,
  History,
  DollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Calendar,
  Clock,
  AlarmClock,
  User,
  Users,
  Phone,
  Video,
  Mic,
  Mail,
  MapPin,
  Globe,
  Briefcase,
  Handshake,
  BookOpen,
  Presentation,
  Lightbulb,
  PenTool,
  Monitor,
  Settings,
  CheckCircle,
  Star,
  Heart,
  Play,
  Tag,
  Share2,
  Repeat,
  RefreshCcw,
  RotateCcw,
  History,
  DollarSign,
};

type Props = {
  iconName?: string;
  color?: string;
  fallbackIcon?: string;
  fallbackColor?: string;
  className?: string;
};

export default function EventTypeIconCard({
  iconName,
  color,
  fallbackIcon = "Calendar",
  fallbackColor = "text-blue-600",
  className = "",
}: Props) {
  const nameToUse = iconName && iconMap[iconName] ? iconName : fallbackIcon;
  const IconComponent = iconMap[nameToUse] ?? Calendar;

  return (
    <div
      className={`rounded-xl bg-gray-50 p-3 ${
        color ?? fallbackColor
      } transition-transform duration-300 group-hover:scale-110 ${className}`}>
      <IconComponent className="h-6 w-6" />
    </div>
  );
}
