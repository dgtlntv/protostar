/**
 * Copyright [yyyy] [name of copyright owner]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The history controller provides an ring-buffer
 */
export class HistoryController {
    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
    }

    /**
     * Push an entry and maintain ring buffer size
     */
    push(entry) {
        // Skip empty entries
        if (entry.trim() === "") return
        // Skip duplicate entries
        const lastEntry = this.entries[this.entries.length - 1]
        if (entry == lastEntry) return
        // Keep track of entries
        this.entries.push(entry)
        if (this.entries.length > this.size) {
            this.entries.pop(0)
        }
        this.cursor = this.entries.length
    }

    /**
     * Rewind history cursor on the last entry
     */
    rewind() {
        this.cursor = this.entries.length
    }

    /**
     * Returns the previous entry
     */
    getPrevious() {
        const idx = Math.max(0, this.cursor - 1)
        this.cursor = idx
        return this.entries[idx]
    }

    /**
     * Returns the next entry
     */
    getNext() {
        const idx = Math.min(this.entries.length, this.cursor + 1)
        this.cursor = idx
        return this.entries[idx]
    }
}
