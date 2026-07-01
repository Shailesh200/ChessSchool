import Svg, { Path, Text as SvgText } from "react-native-svg";
import { colors } from "./theme";

/** Wordmark matching web Logo — compact for mobile headers. */
export function Logo({ height = 28 }: { height?: number }) {
  const width = height * 4.2;
  return (
    <Svg width={width} height={height} viewBox="0 0 168 40">
      <Path d="M8 8h8v24H8V8zm12 0h8l10 16V8h8v24h-8L20 16v16h-8V8z" fill={colors.brand} />
      <SvgText x="52" y="28" fill={colors.ink} fontSize="22" fontWeight="700">
        ChessSchool
      </SvgText>
    </Svg>
  );
}
