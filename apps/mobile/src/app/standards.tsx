import { S } from '../i18n';
import { Body, Card, Muted, Screen } from '../ui/kit';

export default function Standards() {
  return (
    <Screen>
      <Body>{S.standards.intro}</Body>
      <Card>
        {S.standards.rules.map((r) => (
          <Body key={r}>• {r}</Body>
        ))}
      </Card>
      <Body>{S.standards.enforcement}</Body>
      <Muted>{S.standards.help}</Muted>
    </Screen>
  );
}
