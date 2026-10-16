/**
 * Self-contained page that runs MediaPipe Pose Landmarker inside a WebView on
 * the phone. The camera video stays on the device; only pose landmarks are
 * posted back to the app, where @reppilot/core scores them.
 *
 * Messages to the app:  {type:'ready'} | {type:'error',message} | {type:'pose',ok} | {type:'frames',frames}
 * Commands from the app: window.rpStart() / window.rpStop()
 */
const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html,body{margin:0;background:#000;height:100%;overflow:hidden}
  #wrap{position:relative;width:100%;height:100%}
  video,canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
</style></head>
<body><div id="wrap"><video id="v" playsinline muted autoplay></video><canvas id="c"></canvas></div>
<script type="module">
const post = (m) => (window.ReactNativeWebView ? window.ReactNativeWebView.postMessage(JSON.stringify(m)) : window.parent.postMessage(m, '*'));
const video = document.getElementById('v');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let detector = null, recording = false, start = 0, frames = [], lastPoseOk = null;
const MAX_MS = 20000;
const round = (n) => Math.round(n * 1000) / 1000;

window.rpStart = () => { frames = []; start = performance.now(); recording = true; };
window.rpStop = () => {
  if (!recording) return;
  recording = false;
  post({ type: 'frames', frames });
  frames = [];
};

function draw(lm) {
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  ctx.fillStyle = '#22C55E';
  for (const i of [11,12,13,14,15,16,23,24,25,26,27,28]) {
    const p = lm[i];
    if (!p || p.visibility < 0.5) continue;
    ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 7, 0, Math.PI * 2); ctx.fill();
  }
}

function loop() {
  if (video.readyState >= 2 && detector) {
    const now = performance.now();
    const res = detector.detectForVideo(video, now);
    const lm = res.landmarks[0];
    draw(lm);
    const ok = !!lm;
    if (ok !== lastPoseOk) { lastPoseOk = ok; post({ type: 'pose', ok }); }
    if (recording) {
      // Compact form: [x, y, visibility] per landmark.
      if (lm) frames.push({ t: Math.round(now - start), l: lm.map((p) => [round(p.x), round(p.y), round(p.visibility)]) });
      if (now - start >= MAX_MS) window.rpStop();
    }
  }
  requestAnimationFrame(loop);
}

(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    const { FilesetResolver, PoseLandmarker } = await import('${MEDIAPIPE}/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks('${MEDIAPIPE}/wasm');
    const make = (delegate) => PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '${MODEL}', delegate }, runningMode: 'VIDEO', numPoses: 1 });
    detector = await make('GPU').catch(() => make('CPU'));
    post({ type: 'ready' });
    loop();
  } catch (e) {
    post({ type: 'error', message: String(e && e.message || e) });
  }
})();
</script></body></html>`;

/** Expands the compact frames posted by the page into the core PoseFrame shape. */
export function expandFrames(frames: { t: number; l: [number, number, number][] }[]) {
  return frames.map((f) => ({ t: f.t, landmarks: f.l.map(([x, y, visibility]) => ({ x, y, visibility })) }));
}
