import { useState } from 'react';
import { applyReminders, remindersSupported } from '../features/reminders';
import { S } from '../i18n';
import { useStore } from '../state/store';
import { Body, Button, Card, Chip, ChipRow, Muted, Screen } from '../ui/kit';

const HOURS = [6, 7, 8, 12, 17, 18, 19, 20];

export default function RemindersScreen() {
  const { state, dispatch } = useStore();
  const [r, setR] = useState(state.reminders);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Screen>
      <Body>{S.reminders.intro}</Body>
      {!remindersSupported ? (
        <Card tone="warn">
          <Body>{S.reminders.webNote}</Body>
        </Card>
      ) : null}
      <Card>
        <ChipRow>
          <Chip label={S.reminders.workout} selected={r.workout} onPress={() => setR({ ...r, workout: !r.workout })} />
        </ChipRow>
        {r.workout ? (
          <>
            <Muted>{S.reminders.time}</Muted>
            <ChipRow>
              {HOURS.map((h) => (
                <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} selected={r.workoutHour === h} onPress={() => setR({ ...r, workoutHour: h })} />
              ))}
            </ChipRow>
          </>
        ) : null}
        <ChipRow>
          <Chip label={S.reminders.water} selected={r.water} onPress={() => setR({ ...r, water: !r.water })} />
        </ChipRow>
      </Card>
      <Button
        label={S.common.save}
        onPress={async () => {
          const ok = await applyReminders(r, state.profile?.trainingDays ?? []).catch(() => false);
          dispatch({ type: 'setReminders', reminders: ok ? r : { ...r, workout: false, water: false } });
          setMsg(ok ? S.reminders.saved : S.reminders.denied);
        }}
      />
      {msg ? <Body>{msg}</Body> : null}
    </Screen>
  );
}
