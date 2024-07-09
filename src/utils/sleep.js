import { setInputDisabled, setCurrentOperation } from "../components/KeyboardHandler.js"

export default async function sleep(duration, operation) {
    setInputDisabled(true)
    try {
        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, duration)
            const checkCancellation = setInterval(() => {
                if (operation.isCancelled()) {
                    clearTimeout(timeout)
                    clearInterval(checkCancellation)
                    resolve()
                }
            }, 100)
        })
    } finally {
        setInputDisabled(false)
    }
}
