// Ambient declarations so TypeScript accepts CSS side-effect imports used by
// the web variants of the template (Metro/Expo strip these on native).
declare module "*.css";
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
