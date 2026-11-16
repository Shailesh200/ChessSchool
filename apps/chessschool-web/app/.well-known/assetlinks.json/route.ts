/**
 * Android App Links. The SHA-256 certificate fingerprints come from ANDROID_APP_FINGERPRINTS
 * (comma-separated, colon-separated hex as Play Console shows them). With none set the list is
 * empty, so Android simply does not verify the links; a made-up fingerprint is never served.
 */
const PACKAGE = "com.chessschool.app";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_APP_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FINGERPRINT.test(s));
  return Response.json(prints.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: PACKAGE, sha256_cert_fingerprints: prints } }] : []);
}
