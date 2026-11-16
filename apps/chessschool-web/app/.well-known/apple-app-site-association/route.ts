/** Universal links: these paths open the iOS app when it is installed. */
const TEAM_ID = "ARDSWV5GD2";
const BUNDLE_ID = "com.chessschool.app";
export const APP_LINK_PATHS = ["/c/*", "/s/*", "/mate/*", "/i/*"];

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: { details: [{ appIDs: [`${TEAM_ID}.${BUNDLE_ID}`], components: APP_LINK_PATHS.map((path) => ({ "/": path })) }] },
  });
}
