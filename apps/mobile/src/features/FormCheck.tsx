import { analyzeForm, type FormCheckExercise, type FormResult } from '@reppilot/core';
import { useCameraPermissions } from 'expo-camera';
import { useRef, useState, type ComponentType, type Ref } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { S } from '../i18n';
import { radius } from '../theme';
import { Body, Button, Card, H3, Muted } from '../ui/kit';
import { ResultCard, SelfCheck, SetupTips } from './formCheckShared';
import { POSE_HTML, expandFrames } from './poseHtml';

type WebViewHandle = { injectJavaScript: (script: string) => void };
// The platform builds of WebView forward refs; the generic typings do not say so.
const PoseWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

type Phase = 'consent' | 'loading' | 'ready' | 'countdown' | 'recording' | 'result' | 'error';

/**
 * Phone form check: the pose model runs inside a WebView (same MediaPipe
 * model as the web app), on the device. Landmarks come back to the app and
 * are scored by the shared rules in @reppilot/core.
 */
export function FormCheck({ exercise }: { exercise: FormCheckExercise }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('consent');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [poseSeen, setPoseSeen] = useState(false);
  const [result, setResult] = useState<FormResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const web = useRef<WebViewHandle>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    const p = permission?.granted ? permission : await requestPermission();
    if (!p.granted) {
      setError(S.formCheck.cameraDenied);
      setPhase('error');
      return;
    }
    setPhase('loading');
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; message?: string; ok?: boolean; frames?: { t: number; l: [number, number, number][] }[] };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setPhase('ready');
    else if (msg.type === 'pose') setPoseSeen(!!msg.ok);
    else if (msg.type === 'error') {
      setError(S.formCheck.failed);
      setPhase('error');
    } else if (msg.type === 'frames' && msg.frames) {
      if (timer.current) clearInterval(timer.current);
      setResult(analyzeForm(exercise, expandFrames(msg.frames)));
      setPhase('result');
    }
  };

  const beginCountdown = () => {
    setResult(null);
    setPhase('countdown');
    let n = 3;
    setCountdown(n);
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        web.current?.injectJavaScript('window.rpStart(); true;');
        setElapsed(0);
        setPhase('recording');
        const began = Date.now();
        timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 500);
      }
    }, 1000);
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    web.current?.injectJavaScript('window.rpStop(); true;');
  };

  const cameraOn = phase !== 'consent' && phase !== 'error';

  return (
    <>
      <SetupTips exercise={exercise} />
      {phase === 'consent' ? (
        <Card tone="primary">
          <H3>{S.formCheck.consentTitle}</H3>
          <Body>{S.formCheck.consentBody}</Body>
          <Muted>{S.formCheck.consentWeb}</Muted>
          <Button label={S.formCheck.allow} onPress={start} />
        </Card>
      ) : null}
      {phase === 'error' ? (
        <Card tone="warn">
          <Body>{error ?? S.formCheck.failed}</Body>
        </Card>
      ) : null}

      {cameraOn ? (
        <View style={{ height: 380, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' }}>
          <PoseWebView
            ref={web}
            source={{ html: POSE_HTML, baseUrl: 'https://localhost/' }}
            originWhitelist={['*']}
            onMessage={onMessage}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            mediaCapturePermissionGrantType="grant"
            onError={() => {
              setError(S.formCheck.failed);
              setPhase('error');
            }}
          />
        </View>
      ) : null}

      {phase === 'loading' ? <Muted>{S.formCheck.loading}</Muted> : null}
      {phase === 'ready' ? (
        <Card>
          <Body>{S.formCheck.ready}</Body>
          <Muted>{poseSeen ? '🟢' : '⚪'} {poseSeen ? S.formCheck.poseSeen : S.formCheck.poseMissing}</Muted>
          <Button label={S.formCheck.start} onPress={beginCountdown} />
        </Card>
      ) : null}
      {phase === 'countdown' ? <H3>⏱️ {countdown}…</H3> : null}
      {phase === 'recording' ? (
        <Card>
          <Body>🔴 {S.formCheck.recording(elapsed)}</Body>
          <Button label={S.formCheck.stop} onPress={stop} />
        </Card>
      ) : null}
      {phase === 'result' && result ? (
        <>
          <ResultCard result={result} />
          <Button label={S.formCheck.tryAgain} onPress={beginCountdown} />
        </>
      ) : null}
      <Muted>{S.formCheck.nativeNote}</Muted>
      <SelfCheck exercise={exercise} />
    </>
  );
}
