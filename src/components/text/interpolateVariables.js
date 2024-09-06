export default function interpolateVariables(text, argv, globalVariables) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return argv[variable] || globalVariables[variable] || match
    })
}
