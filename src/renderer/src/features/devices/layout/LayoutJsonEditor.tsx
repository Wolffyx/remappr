// Pattern check: no GoF pattern (-) — rejected — thin Monaco wrapper for the layout modal, loaded lazily (Monaco is multi-MB); registers the layout schema on mount.
import type { JSX } from 'react'
import Editor from '@monaco-editor/react'
import { deviceLayoutJsonSchema } from '@firmware/devices/schema'
import { useIsDark } from '@/hooks/use-dark-mode'
import { registerJsonSchema } from '@/lib/monaco'

const SCHEMA_URI = 'inmemory://remappr/device-layout-schema.json'
// The model path ties the layout schema to this editor's model only.
const MODEL_FILE = 'device-layout.json'
const MODEL_PATH = `inmemory://remappr/${MODEL_FILE}`

/** The layout document in Monaco, checked against its schema as you type
 *  (Ctrl/Cmd+Space suggests fields and values). */
export default function LayoutJsonEditor({
    value,
    onChange,
}: {
    value: string
    onChange: (text: string) => void
}): JSX.Element {
    const isDark = useIsDark()
    return (
        <div
            aria-label="Layout JSON"
            className="h-[380px] overflow-hidden rounded-[10px] border border-input"
        >
            <Editor
                path={MODEL_PATH}
                language="json"
                theme={isDark ? 'vs-dark' : 'light'}
                value={value}
                onChange={(text) => onChange(text ?? '')}
                onMount={() =>
                    registerJsonSchema(
                        SCHEMA_URI,
                        MODEL_FILE,
                        deviceLayoutJsonSchema(),
                    )
                }
                options={{
                    minimap: { enabled: false },
                    fontSize: 12.5,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    automaticLayout: true,
                    fixedOverflowWidgets: true,
                }}
            />
        </div>
    )
}
