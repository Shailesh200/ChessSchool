import { Redirect } from "expo-router";

/** A shared card's link opened in the app: the card is for people who do not have the app yet, so go home. */
export default function SharedCardLink() {
  return <Redirect href="/" />;
}
