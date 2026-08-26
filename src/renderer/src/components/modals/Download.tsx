// Pattern check: no GoF pattern (-) — rejected — modal wrapper; the tabbed
// compile/preview/download body is the shared ExportPanel, this only frames it
// with device status, native fallback, import + flash instructions.
import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import {
    AlertTriangle,
    Copy,
    Download as DownloadIcon,
    FileText,
    Upload,
} from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import { downloadExports, exportedContentToString } from '@/lib/blob'
import { type Target, resolveAllowedTargets } from '@firmware/config'
import { connectMockWithConfig } from '@firmware'
import { createLogger } from '@shared/logger'
// The compile/preview/download body drags in the per-firmware compilers —
// lazy-load it; Radix only mounts modal content while open, so the chunk is
// fetched on first open.
const ExportPanel = lazy(() =>
    import('./ExportPanel').then((m) => ({ default: m.ExportPanel })),
)

const log = createLogger('Download')

interface DownloadProps {
    opened?: boolean
    onClose?: () => void
}

export function Download({ opened, onClose }: DownloadProps): JSX.Element {
    // Field-scoped selectors — this component is mounted in the header at all
    // times, so a bare store call would re-render it (closed) on every store
    // change.
    const service = useConnectionStore((s) => s.service)
    const config = useConfigStore((s) => s.config)
    const source = useConfigStore((s) => s.source)
    const error = useConfigStore((s) => s.error)
    const stale = useConfigStore((s) => s.stale)
    const loadFromSource = useConfigStore((s) => s.loadFromSource)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Saves only mark the config stale (the eager per-save device read stalled
    // edits); pull the committed blob when the modal actually needs it.
    useEffect(() => {
        if (opened && stale) {
            useConnectionStore.getState().reseedConfigIfStale()
        }
    }, [opened, stale])

    const fw = service?.deviceInfo.firmware ?? null
    // A demo device pins no compile target — the user can build for anything.
    // Real hardware reports its family and pins it.
    const connectedFirmware = service?.capabilities.demo ? null : fw

    const allowed = useMemo<Target[]>(() => {
        const byDevice = resolveAllowedTargets(connectedFirmware)
        const pinned = config?.meta.target ?? null
        return pinned && byDevice.includes(pinned) ? [pinned] : byDevice
    }, [connectedFirmware, config?.meta.target])

    // Fallback for a connected device with no remappr config (real adapters
    // don't seed one yet): use the device's own faithful native exporter.
    const handleNativeExport = async (): Promise<void> => {
        if (!service) return
        try {
            downloadExports(await service.exportConfig())
            toast.success('Config downloaded')
        } catch (e) {
            log.error('exportConfig failed', e)
            toast.error('Failed to export config')
        }
    }

    const handleNativeCopy = async (): Promise<void> => {
        if (!service) return
        try {
            const primary = (await service.exportConfig())[0]
            if (!primary) {
                toast.error('Nothing to copy')
                return
            }
            await navigator.clipboard.writeText(
                exportedContentToString(primary.content),
            )
            toast.success(`${primary.filename} copied`)
        } catch (e) {
            log.error('copy failed', e)
            toast.error('Failed to copy to clipboard')
        }
    }

    const handleImportSource = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = e.target.files?.[0]
        e.target.value = '' // allow re-importing the same file
        if (!file) return
        let text: string
        try {
            text = await file.text()
        } catch (err) {
            // Fire-and-forget onChange handler — a read failure would surface
            // as an unhandled rejection with no user feedback.
            log.error('failed to read import file', err)
            toast.error(`Failed to read ${file.name}`)
            return
        }
        if (!loadFromSource(text)) {
            toast.error('Invalid config — see error below')
            return
        }
        toast.success(`Imported ${file.name}`)
        // In demo mode the displayed keyboard comes from the mock service, not
        // configStore — so a bare import wouldn't change what's on screen. Rebuild
        // the mock from the imported config (mirrors the demo-connect lifecycle)
        // so the user sees the board they just loaded, no disconnect needed.
        const conn = useConnectionStore.getState()
        const cfg = useConfigStore.getState().config
        if (cfg && conn.service?.capabilities.demo) {
            const next = connectMockWithConfig(cfg)
            next.onClosed((): void => {
                useConnectionStore.getState().setDeviceName(null)
                useConnectionStore.getState().setService(null)
            })
            conn.setDeviceName(next.deviceInfo.name)
            conn.setService(next)
            onClose?.()
        }
    }

    const triggerImport = (): void => fileInputRef.current?.click()
    const firmwareLabel = (fw ?? '').toUpperCase() || 'firmware'

    // pattern-check: skip presentational reorder into header/topActions slots
    // Keyboard name + details — rendered at the top of the export body.
    const statusBlock = (
        <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
            <span
                data-ready={!!config || !!service}
                className="size-2 shrink-0 rounded-full bg-muted-foreground data-[ready=true]:bg-emerald-500 data-[ready=true]:shadow-[0_0_8px] data-[ready=true]:shadow-emerald-500/60"
            />
            <div className="flex-1">
                <div className="text-[13px] font-semibold">
                    {config
                        ? config.meta.name
                        : service
                          ? service.deviceInfo.name
                          : 'No config loaded'}
                </div>
                <div className="text-xs text-muted-foreground">
                    {config
                        ? `${config.layers.length} layer${
                              config.layers.length === 1 ? '' : 's'
                          } · source of truth`
                        : service
                          ? `${firmwareLabel} device · native export`
                          : 'Connect a keyboard or import a .json config'}
                </div>
            </div>
            {(config || service) && (
                <FileText className="size-4 text-emerald-500" />
            )}
        </div>
    )

    // Import button (+ hidden file input) — shared by both branches.
    const importButton = (
        <>
            <Button
                onClick={triggerImport}
                variant="outline"
                className="flex items-center gap-2"
            >
                <Upload className="h-4 w-4" />
                Import .json
            </Button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                className="hidden"
                onChange={handleImportSource}
            />
        </>
    )

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Configuration Export"
            subtitle="Compile your keymap to firmware config"
            headerIcon={<DownloadIcon />}
            customModalBoxClass="w-11/14 max-w-3xl"
            type="icon"
            icon={<DownloadIcon />}
            variant="ghost"
            showFooter={false}
        >
            <div className="min-w-0 space-y-6">
                {config ? (
                    <Suspense fallback={null}>
                        <ExportPanel
                            config={config}
                            source={source}
                            targets={allowed}
                            header={statusBlock}
                            topActions={importButton}
                        />
                    </Suspense>
                ) : (
                    <div className="space-y-6">
                        {statusBlock}

                        {service && (
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Export
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={handleNativeExport}
                                        className="flex items-center gap-2"
                                    >
                                        <DownloadIcon className="h-4 w-4" />
                                        Download {firmwareLabel} config
                                    </Button>
                                    <Button
                                        onClick={handleNativeCopy}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <Copy className="h-4 w-4" />
                                        Copy
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Import
                            </p>
                            {importButton}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs">
                        <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
                        <span>
                            <span className="font-semibold">Import:</span>{' '}
                            {error}
                        </span>
                    </div>
                )}

                <Separator />

                {/* instructions */}
                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Flash to your keyboard
                    </p>
                    <ol className="space-y-2.5 text-sm text-muted-foreground">
                        {[
                            'Download a firmware tab\'s "project (.zip)" for a ready-to-build repo (config + GitHub Actions workflow + README).',
                            'Push the project to a new GitHub repository.',
                            'GitHub Actions builds it automatically — or build locally per the README.',
                            'Download the firmware artifact and flash it to your keyboard.',
                        ].map((step, i) => (
                            <li key={i} className="flex gap-3">
                                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </Modal>
    )
}
