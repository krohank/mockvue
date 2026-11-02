import { FilesetResolver, FaceLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';

/**
 * Loads MediaPipe Tasks Vision models once per page session.
 * Order of preference:
 *   1. Self-hosted files in /public (copied by scripts/setup-vision-assets.mjs)
 *   2. Public CDNs (jsDelivr for WASM, Google Cloud Storage for models)
 * GPU inference is tried first and falls back to CPU.
 */

const MEDIAPIPE_VERSION = '0.10.35';
const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

const WASM_SOURCES = [`${BASE}/mediapipe/wasm`, `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`];

const MODEL_SOURCES = {
  face: [
    `${BASE}/models/face_landmarker.task`,
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  ],
  objects: [
    `${BASE}/models/efficientdet_lite0.tflite`,
    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite',
  ],
};

const isUsableAsset = (res) => {
  if (!res.ok) return false;
  // Dev servers answer unknown paths with index.html; never treat HTML as a model or script.
  const type = res.headers.get('content-type') || '';
  return !type.includes('text/html');
};

const fetchModel = async (urls) => {
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!isUsableAsset(res)) throw new Error(`HTTP ${res.status} for ${url}`);
      const buffer = new Uint8Array(await res.arrayBuffer());
      if (buffer.byteLength < 10_000) throw new Error(`Model at ${url} is too small`);
      return { buffer, url };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No model source available');
};

const resolveWasm = async () => {
  for (const base of WASM_SOURCES) {
    try {
      const probe = await fetch(`${base}/vision_wasm_internal.js`, { method: 'HEAD' });
      if (isUsableAsset(probe)) return FilesetResolver.forVisionTasks(base);
    } catch {
      // try the next source
    }
  }
  // Let MediaPipe try the CDN directly even if the HEAD probe was blocked.
  return FilesetResolver.forVisionTasks(WASM_SOURCES[WASM_SOURCES.length - 1]);
};

/**
 * Software WebGL (SwiftShader, llvmpipe) makes the GPU delegate several times
 * slower than WASM SIMD on the CPU and breaks the object detector, so only use
 * the GPU when a real one is present.
 */
export const hasHardwareGpu = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return !/swiftshader|llvmpipe|software|basic render|softpipe/i.test(renderer);
  } catch {
    return false;
  }
};

const createWithDelegates = async (create, delegates) => {
  let lastError;
  for (const delegate of delegates) {
    try {
      return { task: await create(delegate), delegate };
    } catch (err) {
      lastError = err;
      console.info(`[Vision] ${delegate} delegate unavailable:`, err?.message || err);
    }
  }
  throw lastError;
};

let runtimePromise = null;
let lastTimestamp = 0;

/**
 * MediaPipe VIDEO-mode tasks require strictly increasing timestamps. Every
 * caller (prep check, interview room, both detectors) must share one clock.
 */
export const nextTimestamp = (now = performance.now()) => {
  lastTimestamp = Math.max(now, lastTimestamp + 1);
  return lastTimestamp;
};

/** Drops the cached runtime so the next load creates fresh task graphs. */
export const resetVisionRuntime = async () => {
  const pending = runtimePromise;
  runtimePromise = null;
  if (!pending) return;
  try {
    const rt = await pending;
    rt.faceLandmarker?.close();
    rt.objectDetector?.close();
  } catch {
    /* nothing to close */
  }
};

/**
 * @param {(stage: string) => void} [onProgress]
 * @returns {Promise<{ faceLandmarker, objectDetector, delegate, sources }>}
 */
export const loadVisionRuntime = (onProgress = () => {}) => {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      onProgress('Loading vision runtime');
      const fileset = await resolveWasm();

      onProgress('Downloading face model');
      const faceModel = await fetchModel(MODEL_SOURCES.face);
      const faceDelegates = hasHardwareGpu() ? ['GPU', 'CPU'] : ['CPU'];
      const face = await createWithDelegates((delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: faceModel.buffer, delegate },
          runningMode: 'VIDEO',
          numFaces: 3,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        }),
        faceDelegates
      );

      let objectDetector = null;
      let objectsSource = null;
      try {
        onProgress('Downloading object model');
        const objectModel = await fetchModel(MODEL_SOURCES.objects);
        // Runs ~once per second; CPU is reliable everywhere and fast enough.
        const objects = await createWithDelegates((delegate) =>
          ObjectDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer: objectModel.buffer, delegate },
            runningMode: 'VIDEO',
            scoreThreshold: 0.35,
            maxResults: 6,
            categoryAllowlist: ['person', 'cell phone'],
          }),
          ['CPU']
        );
        objectDetector = objects.task;
        objectsSource = objectModel.url;
      } catch (err) {
        // Face analysis still works without object detection.
        console.warn('[Vision] Object detector unavailable:', err?.message || err);
      }

      onProgress('Ready');
      return {
        faceLandmarker: face.task,
        objectDetector,
        delegate: face.delegate,
        sources: { face: faceModel.url, objects: objectsSource },
      };
    })().catch((err) => {
      runtimePromise = null; // allow a retry later
      throw err;
    });
  }
  return runtimePromise;
};

export const FACE_CONNECTIONS = {
  oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  leftBrow: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  rightBrow: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
};
