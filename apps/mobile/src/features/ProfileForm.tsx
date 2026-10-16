import {
  DIET_LABELS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  LIMITATION_LABELS,
  WEEKDAY_SHORT,
  type Diet,
  type Equipment,
  type Experience,
  type Goal,
  type Limitation,
  type Profile,
  type Weekday,
} from '@reppilot/core';
import { useState } from 'react';
import { S } from '../i18n';
import { Body, Button, Card, Chip, ChipRow, H3, Input, Muted } from '../ui/kit';

const GYM_EQUIPMENT = EQUIPMENT.filter((e) => e !== 'bodyweight' && e !== 'resistance_band' && e !== 'kettlebell');
const MINUTES = [20, 30, 45, 60, 75, 90];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  goal: 'general_fitness',
  experience: 'beginner',
  trainingDays: [0, 2, 4],
  sessionMinutes: 45,
  equipment: [],
  limitations: [],
  diet: 'vegetarian',
};

export function ProfileForm({ initial, submitLabel, onSubmit }: {
  initial: Profile;
  submitLabel: string;
  onSubmit: (p: Profile) => void;
}) {
  const [p, setP] = useState<Profile>(initial);
  const [weight, setWeight] = useState(initial.bodyWeightKg ? String(initial.bodyWeightKg) : '');
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const weightNum = Number(weight.replace(',', '.'));
  const weightValid = weight.trim() === '' || (weightNum >= 30 && weightNum <= 250);
  const canSubmit = p.name.trim().length > 0 && p.trainingDays.length > 0 && weightValid;

  return (
    <>
      <Card>
        <Input label={S.onboarding.name} placeholder={S.onboarding.namePlaceholder} value={p.name} onChangeText={(v) => set('name', v)} maxLength={40} />
      </Card>

      <Card>
        <H3>{S.onboarding.goal}</H3>
        <ChipRow>
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <Chip key={g} label={GOAL_LABELS[g]} selected={p.goal === g} onPress={() => set('goal', g)} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.experience}</H3>
        <ChipRow>
          {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((x) => (
            <Chip key={x} label={EXPERIENCE_LABELS[x]} selected={p.experience === x} onPress={() => set('experience', x)} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.days}</H3>
        <Muted>{S.onboarding.daysHint}</Muted>
        <ChipRow>
          {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => (
            <Chip
              key={d}
              label={WEEKDAY_SHORT[d]}
              selected={p.trainingDays.includes(d)}
              onPress={() => set('trainingDays', toggle(p.trainingDays, d).sort((a, b) => a - b))}
            />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.minutes}</H3>
        <ChipRow>
          {MINUTES.map((m) => (
            <Chip key={m} label={S.common.minutes(m)} selected={p.sessionMinutes === m} onPress={() => set('sessionMinutes', m)} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.equipment}</H3>
        <Muted>{S.onboarding.equipmentHint}</Muted>
        <ChipRow>
          <Chip label={`🏢 ${S.onboarding.gymPreset}`} selected={false} onPress={() => set('equipment', [...GYM_EQUIPMENT])} />
          <Chip label={`🏠 ${S.onboarding.homePreset}`} selected={false} onPress={() => set('equipment', [])} />
        </ChipRow>
        <ChipRow>
          {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
            <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={p.equipment.includes(e)} onPress={() => set('equipment', toggle<Equipment>(p.equipment, e))} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.limitations}</H3>
        <Muted>{S.onboarding.limitationsHint}</Muted>
        <ChipRow>
          {(Object.keys(LIMITATION_LABELS) as Limitation[]).map((l) => (
            <Chip key={l} label={LIMITATION_LABELS[l]} selected={p.limitations.includes(l)} onPress={() => set('limitations', toggle(p.limitations, l))} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <H3>{S.onboarding.diet}</H3>
        <ChipRow>
          {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
            <Chip key={d} label={DIET_LABELS[d]} selected={p.diet === d} onPress={() => set('diet', d)} />
          ))}
        </ChipRow>
        <Input
          label={S.onboarding.weight}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          placeholder="e.g. 65"
          maxLength={5}
        />
        <Muted>{S.onboarding.weightHint}</Muted>
        {!weightValid ? <Body style={{ color: '#B42318' }}>Please enter a weight between 30 and 250 kg, or leave it empty.</Body> : null}
      </Card>

      <Button
        label={submitLabel}
        disabled={!canSubmit}
        onPress={() =>
          onSubmit({
            ...p,
            name: p.name.trim(),
            bodyWeightKg: weight.trim() === '' ? undefined : Math.round(weightNum * 10) / 10,
          })
        }
      />
    </>
  );
}
