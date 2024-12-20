import { useEffect, useState } from "react"

const LONG_PRESS_DURATION = 3000 // ms
const VIBRATION_DURATION = 100 // ms

export function useOnLongPress(){
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

    const startPress = ( callback: () => void) => () => {
        const start = new Date().getTime();
        const detectLongPress = () => {
            const now = new Date().getTime()
            if (now - start >= LONG_PRESS_DURATION) {
                if (navigator.vibrate) {
                    navigator.vibrate(VIBRATION_DURATION);
                }
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
        startPress
    }
}