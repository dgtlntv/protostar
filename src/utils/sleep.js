// Sleep for a random duration between 100ms and 3000ms if no duration is given
// Empty callback if none is given

export default async function sleep(duration = Math.floor(Math.random() * 2900) + 100, callback = async () => {}) {
    await new Promise((resolve) =>
        setTimeout(async () => {
            await callback()
            resolve()
        }, duration)
    )
}
