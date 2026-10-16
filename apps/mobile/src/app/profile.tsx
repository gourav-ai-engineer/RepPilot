import { router } from 'expo-router';
import { useState } from 'react';
import { ProfileForm } from '../features/ProfileForm';
import { applyReminders } from '../features/reminders';
import { LOCALES, S } from '../i18n';
import { useStore, wipeStorage } from '../state/store';
import { Body, Button, Card, Chip, ChipRow, H3, Muted, Screen } from '../ui/kit';

export default function ProfileScreen() {
  const { state, dispatch, today } = useStore();
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!state.profile) return null;

  return (
    <Screen>
      <Card>
        <H3>🌐 {S.settings.language}</H3>
        <ChipRow>
          {LOCALES.map((l) => (
            <Chip key={l.code} label={l.label} selected={state.locale === l.code} onPress={() => dispatch({ type: 'setLocale', locale: l.code })} />
          ))}
        </ChipRow>
        <Button kind="secondary" icon="☁️" label={state.account ? `${S.settings.account} ✓` : S.settings.account} onPress={() => router.push('/account')} />
        <Button kind="secondary" icon="⏰" label={S.settings.reminders} onPress={() => router.push('/reminders')} />
        <Button kind="ghost" icon="📜" label={S.settings.standards} onPress={() => router.push('/standards')} />
      </Card>
      <ProfileForm
        initial={state.profile}
        submitLabel={S.profile.save}
        onSubmit={(profile) => {
          dispatch({ type: 'setProfile', profile, today });
          // Reminders follow the training days.
          if (state.reminders.workout || state.reminders.water) void applyReminders(state.reminders, profile.trainingDays).catch(() => {});
          setSaved(true);
        }}
      />
      {saved ? (
        <Card tone="primary">
          <Body>{S.profile.saved}</Body>
        </Card>
      ) : null}
      <Card tone="danger">
        <H3>{S.profile.dataTitle}</H3>
        <Muted>{S.profile.dataBody}</Muted>
        <Button
          kind="danger"
          label={confirmDelete ? S.profile.deleteConfirm : S.profile.delete}
          onPress={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            await wipeStorage();
            dispatch({ type: 'reset' });
            router.replace('/onboarding');
          }}
        />
      </Card>
    </Screen>
  );
}
