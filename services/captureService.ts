/**
 * Captures a DOM element and returns a base64 image string.
 * Uses html2canvas loaded via CDN in index.html.
 */
export const captureElement = async (target: string | HTMLElement): Promise<string | null> => {
  let element: HTMLElement | null = null;

  if (typeof target === 'string') {
    element = document.getElementById(target);
  } else {
    element = target;
  }

  if (!element || !window.html2canvas) {
    console.error("Element not found or html2canvas not loaded");
    return null;
  }

  try {
    // Wait for any images/fonts to settle before capturing
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await window.html2canvas(element, {
      useCORS: true,
      scale: 2, // Retina quality
      backgroundColor: null, // Transparent background if possible
      logging: false,
      // Ensure we capture the full scroll height if necessary
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    return null;
  }
};

export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
