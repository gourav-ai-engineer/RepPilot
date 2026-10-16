import type { FormCheckExercise } from '@reppilot/core';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { View } from 'react-native';
import { S } from '../i18n';
import { radius } from '../theme';
import { Body, Button, Card, H3, Muted } from '../ui/kit';
import { SelfCheck, SetupTips } from './formCheckShared';

/**
 * Native form check. Live pose analysis needs an on-device pose model in a
 * development build; until that is added, the phone app offers a camera
 * preview for positioning plus the manual self-check. The rules engine
 * (`analyzeForm` in @reppilot/core) is shared with the web version.
 */
export function FormCheck({ exercise }: { exercise: FormCheckExercise }) {
  const [consented, setConsented] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <>
      <SetupTips exercise={exercise} />
      {!consented ? (
        <Card tone="primary">
          <H3>{S.formCheck.consentTitle}</H3>
          <Body>{S.formCheck.consentBody}</Body>
          <Button
            label={S.formCheck.allow}
            onPress={async () => {
              const res = permission?.granted ? permission : await requestPermission();
              setConsented(true);
              void res;
            }}
          />
        </Card>
      ) : permission?.granted ? (
        <Card>
          <View style={{ height: 380, borderRadius: radius.md, overflow: 'hidden' }}>
            <CameraView style={{ flex: 1 }} facing="front" mirror active />
          </View>
          <Muted>{S.formCheck.nativeNote}</Muted>
        </Card>
      ) : (
        <Card tone="warn">
          <Body>{S.formCheck.cameraDenied}</Body>
        </Card>
      )}
      <SelfCheck exercise={exercise} />
    </>
  );
}
