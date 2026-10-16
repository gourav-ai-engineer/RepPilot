import {
  FOODS,
  GLASS_ML,
  HYDRATION_NOTE,
  MICRONUTRIENT_TIPS,
  NUTRITION_DISCLAIMER,
  dailyTotals,
  foodsForDiet,
  getFood,
  proteinRangeG,
  proteinSuggestions,
  waterForDate,
} from '@reppilot/core';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { S } from '../../i18n';
import { newId, useStore } from '../../state/store';
import { colors, space } from '../../theme';
import { Bar, Body, Button, Card, Chip, ChipRow, H3, Input, Muted, Row, Screen, Stepper } from '../../ui/kit';

export default function FoodScreen() {
  const { state, dispatch, today } = useStore();
  const { profile } = state;
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [showVitamins, setShowVitamins] = useState(false);

  const waterMl = waterForDate(state.water, today);
  const glasses = Math.round(waterMl / GLASS_ML);
  const goalGlasses = Math.round(state.waterGoalMl / GLASS_ML);
  const totals = dailyTotals(state.meals, today);
  const range = profile ? proteinRangeG(profile.bodyWeightKg, profile.goal) : null;
  const todaysMeals = state.meals.filter((m) => m.date === today);

  const foods = useMemo(() => {
    const base = profile && !showAll ? foodsForDiet(profile.diet) : FOODS;
    const q = query.trim().toLowerCase();
    return q ? base.filter((f) => f.name.toLowerCase().includes(q)) : base;
  }, [profile, showAll, query]);

  return (
    <Screen>
      <Card tone="primary">
        <H3>💧 {S.food.water}</H3>
        <Body>{S.food.glasses(glasses, goalGlasses)}</Body>
        <Bar value={glasses} max={goalGlasses} color={colors.primary} />
        <Row>
          <Button label={S.food.addGlass} onPress={() => dispatch({ type: 'addWater', entry: { date: today, ml: GLASS_ML } })} />
          <Button kind="ghost" label={S.food.undo} disabled={glasses === 0} onPress={() => dispatch({ type: 'undoWater', date: today })} />
        </Row>
        <Row style={{ alignItems: 'center' }}>
          <Muted>{S.food.goal}:</Muted>
          <Stepper
            value={state.waterGoalMl}
            step={GLASS_ML}
            min={1500}
            max={4000}
            format={(v) => `${(v / 1000).toFixed(2)} L`}
            onChange={(ml) => dispatch({ type: 'setWaterGoal', ml })}
          />
        </Row>
        <Muted>{HYDRATION_NOTE}</Muted>
      </Card>

      <Card>
        <H3>🍽️ {S.food.totals}</H3>
        <Row style={{ flexWrap: 'nowrap' }}>
          {[
            [S.food.kcal, totals.kcal],
            [S.food.protein, `${totals.proteinG} g`],
            [S.food.carbs, `${totals.carbsG} g`],
            [S.food.fat, `${totals.fatG} g`],
          ].map(([label, value]) => (
            <View key={String(label)} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primaryDark }}>{value}</Text>
              <Muted>{label}</Muted>
            </View>
          ))}
        </Row>
        {range ? (
          <>
            <Muted>{S.food.proteinRange(range.min, range.max)}</Muted>
            <Bar value={totals.proteinG} max={range.min} color={colors.good} />
          </>
        ) : null}
        <H3>{S.food.meals}</H3>
        {todaysMeals.length === 0 ? <Muted>{S.food.nothingYet}</Muted> : null}
        {todaysMeals.map((m) => {
          const f = getFood(m.foodId);
          return (
            <Row key={m.id} style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Body style={{ flex: 1 }}>
                {f?.name ?? m.foodId} × {m.servings}
              </Body>
              <Button compact kind="ghost" label={S.common.remove} onPress={() => dispatch({ type: 'removeMeal', id: m.id })} />
            </Row>
          );
        })}
      </Card>

      <Card>
        <H3>➕ {S.food.addFood}</H3>
        <Input placeholder={`🔍 ${S.food.searchFood}`} value={query} onChangeText={setQuery} />
        <ChipRow>
          <Chip label="Show all foods" selected={showAll} onPress={() => setShowAll((v) => !v)} />
        </ChipRow>
        {foods.map((f) => (
          <Pressable key={f.id} onPress={() => { setPicked(f.id === picked ? null : f.id); setServings(1); }} accessibilityRole="button">
            <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: space.xs }}>
              <Body style={{ fontWeight: picked === f.id ? '700' : '400' }}>{f.name}</Body>
              <Muted>
                {f.serving} · {f.kcal} kcal · {f.proteinG} g protein
              </Muted>
              {picked === f.id ? (
                <Row style={{ alignItems: 'center' }}>
                  <Muted>{S.food.servings}:</Muted>
                  <Stepper value={servings} step={0.5} min={0.5} max={10} onChange={setServings} />
                  <Button
                    compact
                    label={S.food.add}
                    onPress={() => {
                      dispatch({ type: 'addMeal', entry: { id: newId(), date: today, foodId: f.id, servings } });
                      setPicked(null);
                    }}
                  />
                </Row>
              ) : null}
            </View>
          </Pressable>
        ))}
      </Card>

      {profile ? (
        <Card>
          <H3>💪 {S.food.ideas}</H3>
          {proteinSuggestions(profile.diet).map((f) => (
            <Body key={f.id}>
              • {f.name} — {f.proteinG} g protein per {f.serving}
            </Body>
          ))}
        </Card>
      ) : null}

      <Card>
        <Pressable onPress={() => setShowVitamins((v) => !v)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <H3>{showVitamins ? '▾' : '▸'} {S.food.vitamins}</H3>
        </Pressable>
        {showVitamins
          ? MICRONUTRIENT_TIPS.map((t) => (
              <View key={t.name} style={{ gap: 2 }}>
                <Body style={{ fontWeight: '600' }}>{t.name}</Body>
                <Muted>{t.why} {t.foods}</Muted>
              </View>
            ))
          : null}
      </Card>
      <Muted>{NUTRITION_DISCLAIMER}</Muted>
    </Screen>
  );
}
