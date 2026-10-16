import { describe, expect, it } from 'vitest';
import { LM, analyzeForm, angleDeg, type Landmark, type PoseFrame } from '../src';

const FPS = 30;

function frame(t: number, points: Record<number, Landmark>): PoseFrame {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  for (const [i, p] of Object.entries(points)) landmarks[Number(i)] = { visibility: 0.95, ...p };
  return { t, landmarks };
}

/** Knee angle goes 175° → bottom → 175° each rep. */
function squatFrames(reps: number, bottom: number, leanDeg: number, repMs = 2000): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const perRep = Math.round((repMs / 1000) * FPS);
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < perRep; i++) {
      const phase = (1 - Math.cos((2 * Math.PI * i) / perRep)) / 2; // 0 → 1 → 0
      const theta = ((175 - (175 - bottom) * phase) * Math.PI) / 180;
      const knee = { x: 0.5, y: 0.7 };
      const ankle = { x: 0.5, y: 0.9 };
      const hip = { x: knee.x - 0.2 * Math.sin(theta), y: knee.y + 0.2 * Math.cos(theta) };
      const lean = ((leanDeg * phase) * Math.PI) / 180;
      const shoulder = { x: hip.x + 0.25 * Math.sin(lean), y: hip.y - 0.25 * Math.cos(lean) };
      frames.push(frame((r * perRep + i) * (1000 / FPS), { [LM.leftHip]: hip, [LM.leftKnee]: knee, [LM.leftAnkle]: ankle, [LM.leftShoulder]: shoulder }));
    }
  }
  return frames;
}

function pushupFrames(reps: number, bottom: number, sag: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const perRep = 2 * FPS;
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < perRep; i++) {
      const phase = (1 - Math.cos((2 * Math.PI * i) / perRep)) / 2;
      const theta = ((175 - (175 - bottom) * phase) * Math.PI) / 180;
      const wrist = { x: 0.3, y: 0.85 };
      const elbow = { x: 0.3, y: 0.7 };
      const shoulder = { x: elbow.x + 0.15 * Math.sin(theta), y: elbow.y + 0.15 * Math.cos(theta) };
      const hip = { x: shoulder.x + 0.25, y: shoulder.y + sag };
      const ankle = { x: shoulder.x + 0.5, y: shoulder.y };
      frames.push(frame((r * perRep + i) * (1000 / FPS), { [LM.leftShoulder]: shoulder, [LM.leftElbow]: elbow, [LM.leftWrist]: wrist, [LM.leftHip]: hip, [LM.leftAnkle]: ankle }));
    }
  }
  return frames;
}

describe('form analysis', () => {
  it('computes joint angles', () => {
    expect(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
  });

  it('counts good squats with no cues', () => {
    const res = analyzeForm('squat', squatFrames(4, 85, 30));
    expect(res.assessable).toBe(true);
    expect(res.reps).toBe(4);
    expect(res.cues).toEqual([]);
    expect(res.confidence).toBe('high');
  });

  it('flags shallow squats and forward lean', () => {
    const res = analyzeForm('squat', squatFrames(4, 125, 70));
    expect(res.cues.map((c) => c.id).sort()).toEqual(['forward_lean', 'shallow_squat']);
    expect(res.cues[0]!.severity).toBe('fix');
  });

  it('flags rushed reps', () => {
    const res = analyzeForm('squat', squatFrames(5, 85, 20, 700));
    expect(res.cues.map((c) => c.id)).toContain('too_fast');
  });

  it('flags sagging hips in push-ups', () => {
    expect(analyzeForm('pushup', pushupFrames(3, 80, 0)).cues).toEqual([]);
    expect(analyzeForm('pushup', pushupFrames(3, 80, 0.07)).cues.map((c) => c.id)).toContain('hips_sag');
  });

  it('says when it cannot assess the movement', () => {
    const frames = squatFrames(3, 85, 20).map((f) => ({ ...f, landmarks: f.landmarks.map((l) => ({ ...l, visibility: 0.2 })) }));
    const res = analyzeForm('squat', frames);
    expect(res.assessable).toBe(false);
    expect(res.cues).toEqual([]);
    expect(res.setupIssues.length).toBeGreaterThan(0);
    expect(res.disclaimer).toMatch(/not an expert or medical/);
  });

  it('warns when the body leaves the frame or the clip is short', () => {
    expect(analyzeForm('squat', squatFrames(1, 85, 20).slice(0, 5)).setupIssues[0]).toMatch(/too short/);
  });
});
