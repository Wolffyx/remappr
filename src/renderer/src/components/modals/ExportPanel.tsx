// pattern-check: skip presentational export panel rewrite, delegates to config layer, no abstraction
//
// The shared core of BOTH export surfaces (editor Download + builder
// BuilderExportModal). The export dialog shows ONLY the remappr source-of-truth
// .json; each firmware's buildable output is a downloadable PROJECT (.zip) —
// config + GitHub Actions workflow + README — not a preview tab. A per-firmware
// readiness checklist (checkCompleteness) surfaces what's still missing (controller,
// USB ids, matrix pins, Vial UID/unlock) before the user pushes to a build.
import { useMemo } from 'react'
import {
    CheckCircle2,
    Copy,
    FileJson,
    Package,
    TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { downloadExports } from '@/lib/blob'
import { zipStore } from '@/lib/zip'
import {
    type ConfigKeymap,
    type Target,
    buildProjectBundle,
    checkCompleteness,
    preferredSourceJson,
    targetCovers,
    targetLabel,
} from '@firmware/config'
import { createLogger } from '@shared/logger'

const log = createLogger('ExportPanel')

/** Firmwares (other than the obvious one) a compiler target also covers, for a
 *  small "· covers VIA · Vial" hint so a target→family collapse is visible.
 *  Which ids a target covers is declared with the target (CAPABILITY_MATRIX),
 *  not decided here — this only intersects that with what the board declares. */
function alsoCovers(config: ConfigKeymap, target: Target): string[] {
    const covered = targetCovers(target)
    if (covered.length === 0) return []
    return (config.keyboard.firmware ?? [])
        .filter((f) => covered.includes(f))
        .map((f) => targetLabel(f))
}

const configId = (config: ConfigKeymap): string =>
    config.keyboard.id || 'remappr'

// pattern-check: skip presentational prop-slot reorder, no abstraction
interface ExportPanelProps {
    config: ConfigKeymap
    /** Raw JSON the config was parsed from, for verbatim "Remappr config" export. */
    source: string | null
    /** Compiler targets to offer project downloads for (defaults to ZMK). */
    targets: Target[]
    /** Keyboard name + details block, rendered at the very top. */
    header?: JSX.Element | null
    /** Wrapper-specific buttons (e.g. Import) shown in the top action row. */
    topActions?: JSX.Element | null
}

export function ExportPanel({
    config,
    source,
    targets,
    header,
    topActions,
}: ExportPanelProps): JSX.Element {
    const id = configId(config)
    // JSON serialization + per-firmware completeness validation — memoized so
    // unrelated parent re-renders (while the modal is open) don't re-run them.
    const code = useMemo(
        () => preferredSourceJson(config, source),
        [config, source],
    )
    const filename = `${id}.keymap.json`
    const readiness = useMemo(() => checkCompleteness(config), [config])

    const handleCopy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(code)
            toast.success(`${filename} copied`)
        } catch (e) {
            log.error('copy failed', e)
            toast.error('Failed to copy to clipboard')
        }
    }

    const handleDownloadConfig = (): void => {
        downloadExports([{ filename, mime: 'application/json', content: code }])
        toast.success(`Downloaded ${filename}`)
    }

    // Each target's whole buildable repo as one .zip — config + .github/workflows
    // + README — ready to push to GitHub Actions.
    const handleDownloadProject = (target: Target): void => {
        try {
            const bundle = buildProjectBundle(config, target)
            const zip = zipStore(
                bundle.files.map((f) => ({
                    path: `${bundle.rootName}/${f.filename}`,
                    data:
                        typeof f.content === 'string'
                            ? new TextEncoder().encode(f.content)
                            : f.content,
                })),
            )
            downloadExports([
                {
                    filename: `${bundle.rootName}.zip`,
                    mime: 'application/zip',
                    content: zip,
                },
            ])
            toast.success(`${targetLabel(target)} project downloaded`)
        } catch (e) {
            log.error('bundle failed', e)
            toast.error('Failed to build project bundle')
        }
    }

    // pattern-check: skip presentational layout reorder, no logic change
    return (
        <div className="min-w-0 space-y-5">
            {/* Keyboard name + details */}
            {header}

            {/* Top action row — all the buttons live up here */}
            <div className="flex flex-wrap items-center gap-2">
                {topActions}
                <Button
                    onClick={handleDownloadConfig}
                    disabled={!code}
                    className="flex items-center gap-2"
                >
                    <FileJson className="size-4" /> Download {filename}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleCopy}
                    disabled={!code}
                    className="flex items-center gap-2"
                >
                    <Copy className="size-4" /> Copy
                </Button>
            </div>

            {/* Per-target project downloads — compact button row */}
            <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Build projects
                </p>
                <div className="flex flex-wrap gap-2">
                    {targets.map((t) => {
                        const covers = alsoCovers(config, t)
                        return (
                            <Button
                                key={t}
                                variant="secondary"
                                onClick={() => handleDownloadProject(t)}
                                className="flex items-center gap-2"
                                title={`Buildable ${targetLabel(t)} project (.zip) with a GitHub Actions workflow`}
                            >
                                <Package className="size-4" />
                                {targetLabel(t)}
                                <span className="text-muted-foreground">
                                    .zip
                                </span>
                                {covers.length > 0 && (
                                    <span className="text-[11px] font-normal text-muted-foreground">
                                        · covers {covers.join(' · ')}
                                    </span>
                                )}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {/* Per-firmware readiness checklist */}
            <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Firmware readiness
                </p>
                <ul className="space-y-1.5">
                    {readiness.map((r) => (
                        <li
                            key={r.firmware}
                            className="rounded-lg border border-border p-2.5"
                        >
                            <div className="flex items-center gap-2 text-[13px] font-semibold">
                                {r.ready ? (
                                    <CheckCircle2 className="size-4 text-emerald-500" />
                                ) : (
                                    <TriangleAlert className="size-4 text-red-500" />
                                )}
                                {r.label}
                                <span className="text-[11px] font-normal text-muted-foreground">
                                    {r.ready ? 'ready to build' : 'needs setup'}
                                </span>
                            </div>
                            {r.issues.length > 0 && (
                                <ul className="mt-1.5 space-y-1 pl-6 text-[11.5px]">
                                    {r.issues.map((i, idx) => (
                                        <li
                                            key={idx}
                                            data-level={i.level}
                                            className="text-muted-foreground data-[level=error]:text-red-400"
                                        >
                                            {i.level === 'error' ? '• ' : '· '}
                                            {i.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Source-of-truth remappr config — full-width JSON preview */}
            <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <FileJson className="size-3.5 shrink-0" />
                    <span>
                        The source-of-truth remappr config. Firmware projects
                        build from it — download each as a ready-to-push .zip
                        above.
                    </span>
                </div>
                <pre className="m-0 max-h-[34vh] w-full overflow-auto rounded-xl border border-border bg-[oklch(0.16_0_0)] p-3.5 font-mono text-[12px] leading-relaxed text-[oklch(0.9_0_0)]">
                    <code>{code || '— empty —'}</code>
                </pre>
            </div>
        </div>
    )
}
