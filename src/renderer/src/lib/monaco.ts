// Pattern check: Dispatch Map (Tier 0) — applied — JSON schemas keyed by uri and merged into one diagnostics call, so each editor adds its own schema without clobbering another's; the environment wiring moved here from the builder's monacoSetup.ts.
//
// One Monaco for the app. Points @monaco-editor/react at the BUNDLED
// monaco-editor instead of its default CDN loader, so editors work offline
// inside Electron; Vite's `?worker` imports bundle the editor and JSON
// language workers. Import this module (lazily: Monaco is multi-MB) before the
// first <Editor/> mounts — it installs itself on load.
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Monaco asks for a worker by language label; JSON gets the json worker, the
// rest (tokenizer/diff) get the base editor worker.
;(
    self as unknown as { MonacoEnvironment: monaco.Environment }
).MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
        if (label === 'json') return new jsonWorker()
        return new editorWorker()
    },
}

loader.config({ monaco })

// monaco-editor 0.55 deprecated the *types* on `languages.json`, but the
// runtime defaults object is unchanged; reach it through a typed shim.
interface JsonSchemaEntry {
    uri: string
    fileMatch: string[]
    schema: unknown
}
interface JsonDefaults {
    setDiagnosticsOptions(options: {
        validate?: boolean
        allowComments?: boolean
        schemas?: JsonSchemaEntry[]
    }): void
}

const schemas = new Map<string, JsonSchemaEntry>()

/**
 * Validate and complete the JSON models whose path ends in `/${file}` against
 * `schema` (red squiggles, Ctrl/Cmd+Space suggestions). Give the editor's
 * model that path (`<Editor path=…>`). Monaco holds one list of schemas for
 * every JSON model, so each editor registers its own here; registering the
 * same `uri` again replaces it.
 */
export function registerJsonSchema(
    uri: string,
    file: string,
    schema: unknown,
): void {
    schemas.set(uri, { uri, fileMatch: [file], schema })
    const json = (
        monaco.languages as unknown as { json: { jsonDefaults: JsonDefaults } }
    ).json
    json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [...schemas.values()],
    })
}

export { monaco }
