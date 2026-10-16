import { useState } from 'react';
import { api, type ReportReason } from '../../api/client';
import { attempt } from '../../api/useApi';
import { S } from '../../i18n';
import { useStore } from '../../state/store';
import { Body, Button, Card, Chip, ChipRow, H3, Input, Row } from '../../ui/kit';

const REASONS: ReportReason[] = ['sexual', 'harassment', 'hate', 'violence', 'self_harm', 'spam', 'misinformation', 'minor_safety', 'other'];

export function ReportSheet({ targetType, targetId, onClose }: { targetType: string; targetId: number; onClose: () => void }) {
  const { state } = useStore();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <Card tone="warn">
      <H3>🚩 {S.report.title}</H3>
      {sent ? (
        <>
          <Body>{msg}</Body>
          <Button compact kind="ghost" label={S.common.done} onPress={onClose} />
        </>
      ) : (
        <>
          <Body>{S.report.why}</Body>
          <ChipRow>
            {REASONS.map((r) => (
              <Chip key={r} label={S.report.reasons[r]} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </ChipRow>
          <Input placeholder={S.report.details} value={details} onChangeText={setDetails} maxLength={500} />
          {msg ? <Body>{msg}</Body> : null}
          <Row>
            <Button
              compact
              label={S.report.send}
              disabled={!reason}
              onPress={async () => {
                const r = await attempt(
                  () => api.report(state.account?.token ?? null, { target_type: targetType, target_id: targetId, reason: reason!, details }),
                  setMsg,
                );
                if (r.ok) {
                  setMsg(r.value.message || S.report.thanks);
                  setSent(true);
                }
              }}
            />
            <Button compact kind="ghost" label={S.common.cancel} onPress={onClose} />
          </Row>
        </>
      )}
    </Card>
  );
}
