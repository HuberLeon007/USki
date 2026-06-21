// Per-icon deep imports from lucide-react-native ship runtime .mjs files but no
// matching .d.ts at those paths; declare them as LucideIcon default exports.
declare module "lucide-react-native/dist/esm/icons/*" {
  import type { LucideIcon } from "lucide-react-native";
  const icon: LucideIcon;
  export default icon;
}
