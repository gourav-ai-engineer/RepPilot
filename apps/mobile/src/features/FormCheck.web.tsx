import type * as Vision from '@mediapipe/tasks-vision';
import { analyzeForm, type FormCheckExercise, type FormResult, type Landmark, type PoseFrame } from '@reppilot/core';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { S } from '../i18n';
import { radius } from '../theme';
import { Body, Button, Card, H3, Muted } from '../ui/kit';
import { ResultCard, SelfCheck, SetupTips } from './formCheckShared';

// Pinned to the @mediapipe/tasks-vision version used for types in package.json.
const MEDIAPIPE_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MODULE_URL = `${MEDIAPIPE_BASE}/vision_bundle.mjs`;
const WASM_URL = `${MEDIAPIPE_BASE}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MAX_RECORD_MS = 20_000;

/**
 * Loads MediaPipe as a native browser ES module at runtime. Metro cannot
 * bundle the package (it uses dynamic import internally), and loading on
 * demand keeps it out of the main bundle.
 */
const importModule = new Function('url', 'return import(url)') as (url: string) => Promise<typeof Vision>;
let visionPromise: Promise<typeof Vision> | null = null;
function loadVision(): Promise<typeof Vision> {
  visionPromise ??= importModule(MODULE_URL).catch((e) => {
    visionPromise = null;
    throw e;
  });
  return visionPromise;
}

type Phase = 'consent' | 'loading' | 'ready' | 'countdown' | 'recording' | 'result' | 'error';

interface Detector {
  detectForVideo(video: HTMLVideoElement, ts: number): { landmarks: Landmark[][] };
  close(): void;
}

/**
 * Web form check: camera frames are processed in the browser with MediaPipe
 * Pose Landmarker and scored by the shared rules in @reppilot/core. No video
 * leaves the device; only the model files are downloaded.
 */
export function FormCheck({ exercise }: { exercise: FormCheckExercise }) {
  const [phase, setPhase] = useState<Phase>('consent');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<FormResult | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);
  const recordStartRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('consent');
  phaseRef.current = phase;

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
  }

  async function start() {
    setPhase('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, PoseLandmarker } = await loadVision();
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const make = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      detectorRef.current = (await make('GPU').catch(() => make('CPU'))) as unknown as Detector;
      setPhase('ready');
      loop();
    } catch {
      stopAll();
      setPhase('error');
    }
  }

  function loop() {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) return;
    if (video.readyState >= 2) {
      const now = performance.now();
      const res = detector.detectForVideo(video, now);
      const lm = res.landmarks[0];
      draw(lm);
      if (phaseRef.current === 'recording' && recordStartRef.current !== null) {
        const t = now - recordStartRef.current;
        if (lm) framesRef.current.push({ t, landmarks: lm.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility })) });
        setElapsed(Math.floor(t / 1000));
        if (t >= MAX_RECORD_MS) finish();
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(lm: Landmark[] | undefined) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    ctx.fillStyle = '#22C55E';
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const p = lm[i];
      if (!p || (p.visibility ?? 1) < 0.5) continue;
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function beginCountdown() {
    setResult(null);
    framesRef.current = [];
    setCountdown(3);
    setPhase('countdown');
    let n = 3;
    const timer = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(timer);
        recordStartRef.current = performance.now();
        setElapsed(0);
        setPhase('recording');
      }
    }, 1000);
  }

  function finish() {
    if (phaseRef.current !== 'recording') return;
    recordStartRef.current = null;
    setResult(analyzeForm(exercise, framesRef.current));
    framesRef.current = [];
    setPhase('result');
  }

  const showCamera = phase !== 'consent' && phase !== 'error';

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
          <Body>{S.formCheck.failed}</Body>
        </Card>
      ) : null}

      <View style={{ display: showCamera ? 'flex' : 'none', borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' }}>
        <View style={{ position: 'relative', width: '100%', aspectRatio: 4 / 3 }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        </View>
      </View>

      {phase === 'loading' ? <Muted>{S.formCheck.loading}</Muted> : null}
      {phase === 'ready' ? (
        <Card>
          <Body>{S.formCheck.ready}</Body>
          <Button label={S.formCheck.start} onPress={beginCountdown} />
        </Card>
      ) : null}
      {phase === 'countdown' ? <H3>⏱️ {countdown}…</H3> : null}
      {phase === 'recording' ? (
        <Card>
          <Body>🔴 {S.formCheck.recording(elapsed)}</Body>
          <Button label={S.formCheck.stop} onPress={finish} />
        </Card>
      ) : null}

      {phase === 'result' && result ? (
        <>
          <ResultCard result={result} />
          <Button label={S.formCheck.tryAgain} onPress={beginCountdown} />
        </>
      ) : null}

      <SelfCheck exercise={exercise} />
    </>
  );
}
