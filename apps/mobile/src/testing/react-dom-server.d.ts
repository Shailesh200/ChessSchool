// Test-only: the mobile app has no @types/react-dom; rnHostMock renders host
// components with react-dom/server's static markup.
declare module "react-dom/server" {
  export function renderToStaticMarkup(element: unknown): string;
}
