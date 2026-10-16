import { Stack, useLocalSearchParams } from 'expo-router';
import { FormCheck } from '../../features/FormCheck';
import { EXERCISE_NAMES, isFormExercise } from '../../features/formCheckShared';
import { S } from '../../i18n';
import { Body, Muted, Screen } from '../../ui/kit';

export default function FormCheckScreen() {
  const { exercise } = useLocalSearchParams<{ exercise: string }>();
  if (!isFormExercise(exercise)) {
    return (
      <Screen>
        <Body>Camera form check is available for squats and push-ups.</Body>
      </Screen>
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: `${S.formCheck.title}: ${EXERCISE_NAMES[exercise]}` }} />
      <FormCheck exercise={exercise} />
      <Muted>{S.safety.notMedical}</Muted>
    </Screen>
  );
}
