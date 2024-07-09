export function interpolate(text, context) {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        try {
            return new Function(...Object.keys(context), `return ${expr}`)(...Object.values(context))
        } catch (error) {
            console.error(`Error interpolating "${expr}":`, error)
            return `{{${expr}}}`
        }
    })
}
