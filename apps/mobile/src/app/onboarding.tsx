import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { DEFAULT_PROFILE, ProfileForm } from '../features/ProfileForm';
import { S } from '../i18n';
import { useStore } from '../state/store';
import { Body, Button, Card, H1, Muted, Screen } from '../ui/kit';

export default function Onboarding() {
  const { state, dispatch, today } = useStore();
  const [adult, setAdult] = useState(false);
  if (state.profile) return <Redirect href="/" />;

  return (
    <Screen>
      <H1>{S.onboarding.welcomeTitle}</H1>
      <Body>{S.onboarding.welcomeBody}</Body>
      {!adult ? (
        <Card tone="primary">
          <Body>{S.onboarding.adultsOnly}</Body>
          <Button label={S.onboarding.confirmAdult} onPress={() => setAdult(true)} />
          <Muted>{S.onboarding.privacy}</Muted>
        </Card>
      ) : (
        <>
          <ProfileForm
            initial={DEFAULT_PROFILE}
            submitLabel={S.onboarding.create}
            onSubmit={(profile) => {
              dispatch({ type: 'setProfile', profile, today });
              router.replace('/');
            }}
          />
          <Muted>{S.onboarding.privacy}</Muted>
        </>
      )}
    </Screen>
  );
}
