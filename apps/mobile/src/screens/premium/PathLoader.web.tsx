import { View } from "react-native";

/** Web has no dotlottie peer. loader.json is vectors only, so there is no still to ship. */
export function PathLoader() {
  return <View style={{ width: 72, height: 84 }} accessibilityLabel="Loading" />;
}
