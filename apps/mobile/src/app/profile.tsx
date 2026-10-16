import { router } from 'expo-router';
import { useState } from 'react';
import { ProfileForm } from '../features/ProfileForm';
import { S } from '../i18n';
import { useStore, wipeStorage } from '../state/store';
import { Body, Button, Card, H3, Muted, Screen } from '../ui/kit';

export default function ProfileScreen() {
  const { state, dispatch, today } = useStore();
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!state.profile) return null;

  return (
    <Screen>
      <ProfileForm
        initial={state.profile}
        submitLabel={S.profile.save}
        onSubmit={(profile) => {
          dispatch({ type: 'setProfile', profile, today });
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
