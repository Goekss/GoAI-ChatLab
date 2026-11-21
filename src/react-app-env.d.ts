/// <reference types="react-scripts" />

// Türkçe: Düz CSS/SCSS/SASS içe aktarmaları için tip bildirimleri.
// Deutsch: Typdeklarationen für reine CSS/SCSS/SASS-Importe.
declare module "*.css" {
  const content: { [key: string]: string };
  export default content;
}

declare module "*.scss" {
  const content: { [key: string]: string };
  export default content;
}

declare module "*.sass" {
  const content: { [key: string]: string };
  export default content;
}
