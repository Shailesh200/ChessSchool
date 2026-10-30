import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "@/Icon";
import { usePremiumKitTheme } from "@/components/kit";
import { createOptionListStyles } from "./boaKitStyles";

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
  const kit = usePremiumKitTheme();
  const styles = useMemo(() => createOptionListStyles(kit), [kit]);

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
              <Icon name={opt.icon} size={22} color={on ? kit.colors.brand : kit.colors.brand600} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, on && styles.titleOn]}>{opt.title}</Text>
              {!!opt.subtitle && <Text style={[styles.sub, on && styles.subOn]}>{opt.subtitle}</Text>}
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
