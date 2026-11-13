import type { Metadata } from "next";
import { copy } from "@chessschool/design";
import { DeleteAccountScreen } from "./screen";

export const metadata: Metadata = { title: copy.accountDelete.title };

export default function DeleteAccountPage() {
  return <DeleteAccountScreen />;
}
