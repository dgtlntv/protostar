export default async function stopSpinner(spinner, component) {
    switch (component.conclusion ? component.conclusion : "succeed") {
        case "succeed":
            await spinner.succeed()
            break
        case "fail":
            await spinner.fail()
            break
        case "stop":
            await spinner.stop()
            break
        default:
            break
    }
}
