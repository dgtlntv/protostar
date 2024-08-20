export default function interpolateVariables(text, argv) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return argv[variable] || match
    })
}
