export const enterInterviewFullscreen = async (page = document) => {
  if (page.fullscreenElement) return;
  if (!page.documentElement?.requestFullscreen || page.fullscreenEnabled === false) {
    throw new Error('Full screen is unavailable in this browser. Try opening the interview in Chrome, Edge or Firefox.');
  }
  try {
    // Request before any network await so the browser still has the button's user activation.
    await page.documentElement.requestFullscreen();
  } catch {
    throw new Error('Your browser blocked full screen. Use Enter full screen to try again.');
  }
  if (!page.fullscreenElement) throw new Error('Full screen did not open. Use Enter full screen to try again.');
};
