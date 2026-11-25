// Camera preview helper shared by the setup page and the interview room.
// The preview is local only: frames are shown in a <video> and never recorded or uploaded.

const FLAG = 'mockvue.cameraPreview';

export class CameraError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.cause = cause;
  }
}

// Turn the browser's terse DOMException into something a student can act on.
export function describeCameraError(error, win = globalThis.window) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new CameraError('blocked',
      'Camera access is blocked. Click the camera or lock icon in the address bar, set Camera to Allow, then reload this page. '
      + 'On Windows, also check Settings > Privacy & security > Camera and allow desktop apps.', error);
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new CameraError('no-device', 'No camera was found. Plug in a webcam or enable the built-in one, then try again.', error);
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return new CameraError('in-use',
      'The camera could not start. Another app or browser tab (Zoom, Teams, Meet, the Windows Camera app) may be using it, '
      + 'or Windows is blocking it. Close those and try again.', error);
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return new CameraError('unsupported-settings', 'This camera does not support the requested video settings.', error);
  }
  return new CameraError('unknown', 'The camera could not start' + (name ? ' (' + name + ')' : '') + '. Reload the page and try again.', error);
}

function unavailableError(win) {
  // Browsers hide navigator.mediaDevices entirely on pages that are not https:// or localhost.
  if (win && win.isSecureContext === false) {
    const host = win.location?.host || 'this address';
    return new CameraError('insecure',
      'Browsers only allow camera access on https:// or http://localhost. You opened the app at ' + host
      + '. Open http://localhost:5173 on this computer instead.');
  }
  return new CameraError('unsupported', 'This browser does not support camera access. Try Chrome, Edge or Firefox.');
}

// Ask for the camera. A strict front-camera request is tried first and a plain
// "any camera" request is the fallback, so a webcam that rejects the first set
// of constraints still works.
export async function startCamera({ nav = globalThis.navigator, win = globalThis.window } = {}) {
  if (!nav?.mediaDevices?.getUserMedia) throw unavailableError(win);
  const attempts = [
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: true, audio: false },
  ];
  let last;
  for (const constraints of attempts) {
    try {
      return await nav.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last = error;
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(error?.name)) break;
    }
  }
  throw describeCameraError(last, win);
}

export const stopCamera = (stream) => stream?.getTracks().forEach((track) => track.stop());

// Show a stream in a <video>. autoplay can be skipped by the browser, so play() is called explicitly.
export function attachStream(video, stream) {
  if (!video || !stream) return Promise.resolve();
  if (video.srcObject !== stream) video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  return Promise.resolve(video.play?.()).catch(() => {});
}

// Tell the page when the camera disappears (unplugged, taken by another app).
export function onCameraLost(stream, callback) {
  const tracks = stream?.getVideoTracks?.() || [];
  const handler = () => callback();
  tracks.forEach((track) => track.addEventListener('ended', handler));
  return () => tracks.forEach((track) => track.removeEventListener('ended', handler));
}

// 'granted' | 'denied' | 'prompt' | 'unknown' (Firefox and Safari cannot query the camera permission).
export async function cameraPermission(nav = globalThis.navigator) {
  try { return (await nav.permissions.query({ name: 'camera' })).state; } catch { return 'unknown'; }
}

// Remember that the student turned the preview on, so the room can resume it
// after the setup page (the setup page's stream ends when the page changes).
export function rememberCamera(on, storage = globalThis.sessionStorage) {
  try { on ? storage.setItem(FLAG, '1') : storage.removeItem(FLAG); } catch { /* storage can be unavailable */ }
}
export function cameraWasOn(storage = globalThis.sessionStorage) {
  try { return storage.getItem(FLAG) === '1'; } catch { return false; }
}
