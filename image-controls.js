import { clamp } from './utils.js';

// Image input and pointer gestures report changes; rendering stays in app.js.
export function bindImageControls({ overlayCanvas, canvasWrap, imageInput, opacityInput,
  ditherSelect, scaleInput, translateXInput, translateYInput, isReady, getSvg,
  getViewBox, onTransform, onImage, onDither }) {
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };
  opacityInput.addEventListener("input", (event) => {
    overlayCanvas.style.opacity = event.target.value;
  });
  ditherSelect.addEventListener("change", (event) => {
    onDither(event.target.value);
  });

  scaleInput.addEventListener("input", onTransform);
  translateXInput.addEventListener("input", onTransform);
  translateYInput.addEventListener("input", onTransform);

  overlayCanvas.addEventListener("pointerdown", (event) => {
    if (!isReady() || event.button !== 0) {
      return;
    }
    isDragging = true;
    overlayCanvas.setPointerCapture(event.pointerId);
    overlayCanvas.style.cursor = "grabbing";
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  overlayCanvas.addEventListener("pointermove", (event) => {
    if (!isDragging || !getSvg()) {
      return;
    }
    const svgRect = getSvg().getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) {
      return;
    }
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    lastPointer = { x: event.clientX, y: event.clientY };
    const dxView = (dx / svgRect.width) * getViewBox().width;
    const dyView = (dy / svgRect.height) * getViewBox().height;
    const nextX = clamp(
      Number(translateXInput.value) + dxView,
      Number(translateXInput.min),
      Number(translateXInput.max)
    );
    const nextY = clamp(
      Number(translateYInput.value) + dyView,
      Number(translateYInput.min),
      Number(translateYInput.max)
    );
    translateXInput.value = `${nextX}`;
    translateYInput.value = `${nextY}`;
    onTransform();
  });

  function endDrag(event) {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    overlayCanvas.style.cursor = "grab";
    if (event && overlayCanvas.hasPointerCapture(event.pointerId)) {
      overlayCanvas.releasePointerCapture(event.pointerId);
    }
  }

  overlayCanvas.addEventListener("pointerup", endDrag);
  overlayCanvas.addEventListener("pointercancel", endDrag);
  overlayCanvas.addEventListener("lostpointercapture", endDrag);
  overlayCanvas.addEventListener(
    "wheel",
    (event) => {
      if (!isReady()) {
        return;
      }
      event.preventDefault();
      const scaleMin = Number(scaleInput.min);
      const scaleMax = Number(scaleInput.max);
      const current = Number(scaleInput.value);
      const factor = 1 - event.deltaY * 0.001;
      const next = clamp(current * factor, scaleMin, scaleMax);
      scaleInput.value = `${next}`;
      onTransform();
    },
    { passive: false }
  );

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    onImage(file);
  });

  window.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          onImage(file);
        }
        break;
      }
    }
  });

  canvasWrap.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  canvasWrap.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    onImage(file);
  });
  return { endDrag };
}
