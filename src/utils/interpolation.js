export function interpolate(text, context) {
    return text.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        return eval(`with (context) { ${expr} }`)
    })
}
