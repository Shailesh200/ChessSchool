import { PRIVACY_URL } from "@chessschool/design";

export function GET() {
  return Response.redirect(PRIVACY_URL, 307);
}
