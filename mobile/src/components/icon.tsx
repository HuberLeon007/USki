import type { ColorValue } from "react-native";
import type { LucideIcon } from "lucide-react-native";

// Deep per-icon imports (not the barrel) so Metro only bundles the icons we
// actually use instead of all ~1000 lucide glyphs. SVG icons render identically
// on Android, iOS and web.
import ArrowUp from "lucide-react-native/dist/esm/icons/arrow-up";
import Bell from "lucide-react-native/dist/esm/icons/bell";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Folder from "lucide-react-native/dist/esm/icons/folder";
import House from "lucide-react-native/dist/esm/icons/house";
import Layers from "lucide-react-native/dist/esm/icons/layers";
import LogOut from "lucide-react-native/dist/esm/icons/log-out";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Search from "lucide-react-native/dist/esm/icons/search";
import Settings from "lucide-react-native/dist/esm/icons/settings";
import Share2 from "lucide-react-native/dist/esm/icons/share-2";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import User from "lucide-react-native/dist/esm/icons/user";
import Users from "lucide-react-native/dist/esm/icons/users";
import X from "lucide-react-native/dist/esm/icons/x";

const ICONS = {
  home: House,
  layers: Layers,
  search: Search,
  users: Users,
  user: User,
  sparkles: Sparkles,
  settings: Settings,
  bell: Bell,
  add: Plus,
  chevron: ChevronRight,
  folder: Folder,
  trash: Trash2,
  share: Share2,
  leave: LogOut,
  send: ArrowUp,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color as string} strokeWidth={2} />;
}
