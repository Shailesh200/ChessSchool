import { copy, rankedSkills, weakSkills, type Skills } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { Button, Card, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Profile "Skills": strongest and weakest ideas, and what to practise next. */
export function SkillsCard({ skills }: { skills: Skills | undefined }) {
  const { c } = useTheme();
  const t = copy.skills;
  const ranked = rankedSkills(skills);
  const next = weakSkills(skills)[0];
  const bar = (id: (typeof ranked)[number]) => (
    <View key={id.id} accessible accessibilityLabel={t.score(t.names[id.id], id.s)} style={{ gap: 4 }}>
      <T role="small">{t.names[id.id]}</T>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.sunken, overflow: "hidden" }}>
        <View style={{ width: `${id.s}%`, height: 8, backgroundColor: id.s >= 70 ? c.success : id.s < 45 ? c.danger : c.gold }} />
      </View>
    </View>
  );
  const strong = [...ranked].reverse().slice(0, 2);
  const weak = ranked.filter((x) => !strong.includes(x)).slice(0, 2);
  return (
    <Card style={{ gap: 12 }}>
      <T role="heading" header>
        {t.title}
      </T>
      {!ranked.length ? (
        <T role="small" color="textMuted">
          {t.empty}
        </T>
      ) : (
        <>
          <T role="micro" color="textSubtle">
            {t.strongest}
          </T>
          {strong.map(bar)}
          {weak.length ? (
            <>
              <T role="micro" color="textSubtle">
                {t.weakest}
              </T>
              {weak.map(bar)}
            </>
          ) : null}
          {next ? (
            <>
              <T role="label">{t.next(t.names[next])}</T>
              <Button title={t.practice} icon="practice" variant="secondary" onPress={() => router.push("/practice")} />
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
