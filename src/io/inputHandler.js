import stringArgv from "string-argv"
import { COMMAND_LINE_PREFIX } from "../config/commandLineConfig.js"
import getColoredText from "../utils/getColoredText.js"

export default function inputHandler(localEcho, term, yargs) {
    function handleInput() {
        localEcho.read(getColoredText(COMMAND_LINE_PREFIX, true)).then((input) => {
            const argv = stringArgv(input)
            
            yargs.parse(argv, function (err, argv, output) {
                if (output) localEcho.println(output)
                handleInput()
            })
        })
    }
    
    handleInput()
}