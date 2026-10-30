import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/Icon";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "./premiumTokens";

export type OptionItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: IconName;
};

export function OptionList({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: OptionItem[];
  value: string;
  onChange: (id: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const on = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(opt.id)}
            style={[styles.row, on && styles.rowOn]}
          >
            <View style={[styles.icon, on && styles.iconOn]}>
              <Icon name={opt.icon} size={22} color={on ? premiumColors.brand : premiumColors.brandOnSoftIcon} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, on && styles.titleOn]}>{opt.title}</Text>
              {!!opt.subtitle && (
                <Text style={[styles.sub, on && styles.subOn]}>{opt.subtitle}</Text>
              )}
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <Icon name="check" size={14} color={premiumColors.textOnBrand} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[3],
    backgroundColor: premiumColors.surface,
    borderWidth: 1.5,
    borderColor: premiumColors.line,
    borderRadius: premiumRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: premiumSpace[4],
    marginBottom: premiumSpace[2],
  },
  rowOn: {
    borderColor: premiumColors.brand,
    backgroundColor: premiumColors.surfaceSoft,
    shadowColor: premiumColors.brandEdge,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: premiumRadius.sm,
    backgroundColor: premiumColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOn: { backgroundColor: premiumColors.surface },
  text: { flex: 1, minWidth: 0 },
  title: { ...premiumType.body, fontFamily: premiumFont.uiBold, color: premiumColors.text },
  titleOn: { color: premiumColors.brandSoftText },
  sub: { ...premiumType.caption, fontFamily: premiumFont.ui, color: premiumColors.textMuted, marginTop: 2 },
  subOn: { color: premiumColors.brandSoftText },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: premiumColors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: premiumColors.brand, borderColor: premiumColors.brand },
});
