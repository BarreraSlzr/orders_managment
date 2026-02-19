import { useEffect, useRef, useState } from "react"

const LONG_PRESS_DURATION = 600 // ms
const VIBRATION_DURATION = 100 // ms

export function useOnLongPress(){
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
    /**
     * Set to true when the long-press callback fires.
     * Consumers should read this in onClick and bail (then reset) to prevent
     * the synthetic click that fires immediately after touchEnd / mouseUp.
     */
    const didFire = useRef(false);

    const startPress = ( callback: () => void) => () => {
        didFire.current = false;
        const start = new Date().getTime();
        const detectLongPress = () => {
            const now = new Date().getTime()
            if (now - start >= LONG_PRESS_DURATION) {
                if (navigator.vibrate) {
                    navigator.vibrate(VIBRATION_DURATION);
                }
                didFire.current = true;
                callback()
            }
        }
        setPressTimer(setTimeout(detectLongPress, LONG_PRESS_DURATION))
    }

    const endPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer)
            setPressTimer(null)
        }
    }

    useEffect(() => {
        return () => {
            if (pressTimer) {
                clearTimeout(pressTimer)
            }
        }
    }, [pressTimer])
    return {
        endPress,
        startPress,
        didFire,
    }
}