import { useEffect, useRef } from "react";

const LONG_PRESS_DURATION = 600; // ms
const VIBRATION_DURATION = 100; // ms
const MOVE_THRESHOLD = 10; // px

export function useOnLongPress() {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  /**
   * Set to true when the long-press callback fires.
   * Consumers should read this in onClick and bail (then reset) to prevent
   * the synthetic click that fires immediately after touchEnd / mouseUp.
   */
  const didFire = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const getPoint = (event?: React.MouseEvent | React.TouchEvent) => {
    if (!event) return null;
    if ("touches" in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return null;
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: event.clientX, y: event.clientY };
  };

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button,input,select,textarea,a,[role='button'],[data-no-longpress='true']",
      ),
    );
  };

  const startPress = (callback: () => void) => (
    event?: React.MouseEvent | React.TouchEvent,
  ) => {
    if (event && isInteractiveTarget(event.target)) {
      return;
    }
    didFire.current = false;

    startPoint.current = getPoint(event);
    clearPressTimer();

    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(VIBRATION_DURATION);
      }
      didFire.current = true;
      callback();
    }, LONG_PRESS_DURATION);
  };

  const movePress = (event?: React.MouseEvent | React.TouchEvent) => {
    if (!pressTimer.current) return;
    if (!startPoint.current) return;

    const point = getPoint(event);
    if (!point) return;

    const deltaX = Math.abs(point.x - startPoint.current.x);
    const deltaY = Math.abs(point.y - startPoint.current.y);
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      clearPressTimer();
    }
  };

  const endPress = () => {
    clearPressTimer();
    startPoint.current = null;
  };

  useEffect(() => {
    return () => {
      clearPressTimer();
    };
  }, []);

  return {
    endPress,
    movePress,
    startPress,
    didFire,
  };
}
