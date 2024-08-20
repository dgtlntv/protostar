/*
The MIT License (X11 License)

Copyright (c) 2015-2022 Andi Dittrich

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the 
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the 
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// default time format

// format a number of seconds into hours and minutes as appropriate
export default function formatTime(t, options, roundToMultipleOf) {
    function round(input) {
        if (roundToMultipleOf) {
            return roundToMultipleOf * Math.round(input / roundToMultipleOf)
        } else {
            return input
        }
    }

    // leading zero padding
    function autopadding(v) {
        return (options.autopaddingChar + v).slice(-2)
    }

    // > 1h ?
    if (t > 3600) {
        return autopadding(Math.floor(t / 3600)) + "h" + autopadding(round((t % 3600) / 60)) + "m"

        // > 60s ?
    } else if (t > 60) {
        return autopadding(Math.floor(t / 60)) + "m" + autopadding(round(t % 60)) + "s"

        // > 10s ?
    } else if (t > 10) {
        return autopadding(round(t)) + "s"

        // default: don't apply round to multiple
    } else {
        return autopadding(t) + "s"
    }
}
