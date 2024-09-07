import Handlebars from "handlebars"

export default function interpolateVariables(text, argv, globalVariables) {
    return Handlebars.compile(text)({
        ...argv,
        ...globalVariables,
    })
}
