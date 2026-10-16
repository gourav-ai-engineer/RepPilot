import { router } from 'expo-router';
import { useState } from 'react';
import { API_URL, api, type ModAction } from '../api/client';
import { attempt, useApi } from '../api/useApi';
import { useSyncNow } from '../features/sync';
import { S } from '../i18n';
import { useStore, wipeStorage } from '../state/store';
import { colors } from '../theme';
import { Body, Button, Card, Chip, ChipRow, H2, H3, Input, Muted, Row, Screen } from '../ui/kit';

function SignIn() {
  const { dispatch } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await attempt(
      () =>
        mode === 'login'
          ? api.login(email.trim(), password)
          : api.register({ email: email.trim(), password, display_name: name.trim(), date_of_birth: dob.trim(), accept_community_standards: accept }),
      setErr,
    );
    setBusy(false);
    if (r.ok) {
      dispatch({ type: 'setAccount', account: { token: r.value.token, user: r.value.user } });
      router.back();
    }
  };

  const validDob = /^\d{4}-\d{2}-\d{2}$/.test(dob.trim());
  const canSubmit =
    email.includes('@') && password.length >= 8 && (mode === 'login' || (name.trim().length > 0 && validDob && accept));

  return (
    <>
      <Body>{S.account.why}</Body>
      <Card>
        <H3>{mode === 'login' ? S.account.login : S.account.register}</H3>
        <Input label={S.account.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Input label={S.account.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {mode === 'register' ? (
          <>
            <Input label={S.account.displayName} value={name} onChangeText={setName} maxLength={40} />
            <Input label={S.account.dob} value={dob} onChangeText={setDob} placeholder="1998-04-21" maxLength={10} />
            <Muted>{S.account.dobHint}</Muted>
            <ChipRow>
              <Chip label={S.account.acceptStandards} selected={accept} onPress={() => setAccept((a) => !a)} />
            </ChipRow>
            <Button compact kind="ghost" label={`📜 ${S.account.readStandards}`} onPress={() => router.push('/standards')} />
          </>
        ) : null}
        {err ? <Body style={{ color: colors.danger }}>{err}</Body> : null}
        <Button label={mode === 'login' ? S.account.login : S.account.register} disabled={!canSubmit || busy} onPress={submit} />
        <Button
          kind="ghost"
          label={mode === 'login' ? S.account.needAccount : S.account.haveAccount}
          onPress={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
        />
      </Card>
      <Muted>
        {S.account.serverNote}: {API_URL}
      </Muted>
    </>
  );
}

function Decisions() {
  const actions = useApi((t) => api.myActions(t));
  const [appealing, setAppealing] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const list: ModAction[] = actions.data ?? [];
  return (
    <Card>
      <H3>{S.account.decisions}</H3>
      {list.length === 0 ? <Muted>{S.account.noDecisions}</Muted> : null}
      {list.map((a) => (
        <Card key={a.id}>
          <Body>
            {a.action} · {a.target_type} #{a.target_id}
          </Body>
          {a.reason ? <Muted>{a.reason}</Muted> : null}
          {a.appeal_status ? (
            <Muted>
              {S.account.appeal}: {a.appeal_status}
            </Muted>
          ) : appealing === a.id ? (
            <>
              <Input value={text} onChangeText={setText} placeholder={S.account.appealPlaceholder} multiline maxLength={1000} />
              <Button
                compact
                label={S.account.appeal}
                disabled={text.trim().length < 5}
                onPress={async () => {
                  const r = await attempt(() => api.appeal(actions.token, a.id, text.trim()), setMsg);
                  if (r.ok) {
                    setMsg(S.account.appealSent);
                    setAppealing(null);
                    setText('');
                    void actions.reload();
                  }
                }}
              />
            </>
          ) : (
            <Button compact kind="ghost" label={S.account.appeal} onPress={() => setAppealing(a.id)} />
          )}
        </Card>
      ))}
      {msg ? <Muted>{msg}</Muted> : null}
    </Card>
  );
}

export default function AccountScreen() {
  const { state, dispatch } = useStore();
  const syncNow = useSyncNow();
  const account = state.account;
  const [bio, setBio] = useState(account?.user.bio ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!account) {
    return (
      <Screen>
        <SignIn />
      </Screen>
    );
  }
  const { user, token } = account;
  const sync = state.sync;

  const updateMe = async (patch: Parameters<typeof api.updateMe>[1]) => {
    const r = await attempt(() => api.updateMe(token, patch), setMsg);
    if (r.ok) {
      dispatch({ type: 'updateUser', user: r.value });
      setMsg('✓');
    }
  };

  return (
    <Screen>
      <H2>{S.account.loggedInAs(user.display_name)}</H2>
      <Muted>{user.email}</Muted>
      {user.role === 'moderator' ? (
        <Card tone="primary">
          <Body>🛡️ {S.account.moderator}</Body>
          <Button compact label={S.account.openModeration} onPress={() => router.push('/moderation')} />
        </Card>
      ) : null}
      {user.suspended ? (
        <Card tone="warn">
          <Body>{S.account.suspended}</Body>
        </Card>
      ) : null}

      <Card>
        <H3>☁️ {S.account.syncStatus}</H3>
        <Body>
          {sync.status === 'syncing'
            ? S.account.syncing
            : sync.lastSyncedAt
              ? S.account.syncedAt(new Date(sync.lastSyncedAt).toLocaleString())
              : S.account.syncNever}
        </Body>
        {sync.status === 'error' && sync.error ? <Muted style={{ color: colors.danger }}>{sync.error}</Muted> : null}
        <Button compact kind="secondary" label={S.account.syncNow} onPress={() => void syncNow()} />
      </Card>

      <Card>
        <H3>{S.account.profileVisibility}</H3>
        <ChipRow>
          <Chip label={S.account.visFriends} selected={user.profile_visibility === 'friends'} onPress={() => updateMe({ profile_visibility: 'friends' })} />
          <Chip label={S.account.visPublic} selected={user.profile_visibility === 'public'} onPress={() => updateMe({ profile_visibility: 'public' })} />
        </ChipRow>
        <Input label={S.account.bio} value={bio} onChangeText={setBio} maxLength={200} />
        <Button compact label={S.account.saveProfile} onPress={() => updateMe({ bio, experience: state.profile?.experience })} />
        {msg ? <Muted>{msg}</Muted> : null}
        <Muted>{S.account.strikes(user.strikes)}</Muted>
      </Card>

      <Decisions />

      <Row>
        <Button kind="ghost" label={S.account.logoutKeep} onPress={() => dispatch({ type: 'logout' })} />
      </Row>
      <Button
        kind="ghost"
        label={S.account.logoutWipe}
        onPress={async () => {
          await wipeStorage();
          dispatch({ type: 'reset' });
          router.replace('/onboarding');
        }}
      />
      <Button
        kind="danger"
        label={confirmDelete ? S.account.deleteAccountConfirm : S.account.deleteAccount}
        onPress={async () => {
          if (!confirmDelete) return setConfirmDelete(true);
          const r = await attempt(() => api.deleteAccount(token), setMsg);
          if (r.ok) dispatch({ type: 'logout' });
        }}
      />
    </Screen>
  );
}
