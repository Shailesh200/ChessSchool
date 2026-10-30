import LottieView from "lottie-react-native";

const loaderLottie = require("../../../assets/kit/lottie/loader.json");

export function PathLoader() {
  return <LottieView source={loaderLottie} autoPlay loop style={{ width: 96, height: 112 }} />;
}
