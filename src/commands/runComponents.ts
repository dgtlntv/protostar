/**
 * @file Component-list dispatcher. Walks a single component or array of
 * components and routes each to the matching `run*` implementation. The
 * exhaustive switch is the single source of truth for which component types
 * the runtime understands.
 */

import type { Component as ProtoComponent } from "../types/commands.js"
import type { ComponentContext } from "../components/context.js"
import { runText } from "../components/text.js"
import { runProgressBar } from "../components/progressBar.js"
import { runSpinner } from "../components/spinner.js"
import { runTable } from "../components/table.js"
import { runConditional } from "../components/conditional.js"
import { runVariable } from "../components/variable.js"
import {
    runInput,
    runNumber,
    runPassword,
    runInvisible,
} from "../components/prompts/input.js"
import { runList } from "../components/prompts/list.js"
import { runSelect, runAutoComplete } from "../components/prompts/select.js"
import { runMultiSelect } from "../components/prompts/multiSelect.js"
import { runConfirm } from "../components/prompts/confirm.js"
import { runForm } from "../components/prompts/form.js"
import { runBasicAuth } from "../components/prompts/basicAuth.js"
import { runToggle } from "../components/prompts/toggle.js"
import { runSort } from "../components/prompts/sort.js"

/**
 * Run `components` against `ctx`, sequencing them in order. Accepts either a
 * single component or an array — the legacy schema permits both shapes for
 * `handler` and for `conditional.then` / `conditional.else`.
 *
 * @param components One component or an array of components.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once every component has finished.
 */
export async function runComponents(
    components: ProtoComponent | ProtoComponent[],
    ctx: ComponentContext
): Promise<void> {
    const list = Array.isArray(components) ? components : [components]
    for (const component of list) {
        await runOne(component, ctx)
    }
}

/**
 * Dispatch a single component to its handler. Exhaustive over the
 * `Component` discriminated union — adding a new component type triggers a
 * compile error here.
 */
async function runOne(
    component: ProtoComponent,
    ctx: ComponentContext
): Promise<void> {
    switch (component.component) {
        case "text":
            return runText(component, ctx)
        case "progressBar":
            return runProgressBar(component, ctx)
        case "spinner":
            return runSpinner(component, ctx)
        case "table":
            return runTable(component, ctx)
        case "conditional":
            return runConditional(component, ctx)
        case "variable":
            return runVariable(component, ctx)
        case "input":
            return runInput(component, ctx)
        case "number":
            return runNumber(component, ctx)
        case "password":
            return runPassword(component, ctx)
        case "invisible":
            return runInvisible(component, ctx)
        case "list":
            return runList(component, ctx)
        case "select":
            return runSelect(component, ctx)
        case "autoComplete":
            return runAutoComplete(component, ctx)
        case "multiSelect":
            return runMultiSelect(component, ctx)
        case "confirm":
            return runConfirm(component, ctx)
        case "form":
            return runForm(component, ctx)
        case "basicAuth":
            return runBasicAuth(component, ctx)
        case "toggle":
            return runToggle(component, ctx)
        case "sort":
            return runSort(component, ctx)
        default: {
            const _exhaustive: never = component
            void _exhaustive
            return
        }
    }
}
