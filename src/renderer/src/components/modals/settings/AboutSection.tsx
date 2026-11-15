import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { APP_VERSION } from '@/lib/constants'
import { isElectron as isElectronEnv } from '@/transport'
import type { UpdateCheckResultPayload } from '../../../../../shared/ipc-types'
import { IpcChannels } from '../../../../../shared/ipc-types'
import { getApi } from '@/electron/api'
import { openCurrentReleaseNotes } from '@/features/news/whatsNew'
import { Switch } from '@/ui/switch'
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from '@/ui/field'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { builderSource } from '@/lib/builderPackage/source'
import { isCloudConfigured } from '@/lib/cloud/env'

/** Beta builder packages: only for builds that load the delivered builder. */
function BuilderChannelField(): JSX.Element | null {
    const channel = useUserSettingsStore((s) => s.builderChannel)
    const setChannel = useUserSettingsStore((s) => s.setBuilderChannel)
    if (builderSource() !== 'delivered' || !isCloudConfigured()) return null
    return (
        <FieldLabel htmlFor="builder-beta">
            <Field orientation="horizontal">
                <FieldContent>
                    <FieldTitle>Beta builder updates</FieldTitle>
                    <FieldDescription>
                        Get new builder versions before they reach everyone.
                        Turning this off keeps the builder you have until a
                        newer stable one comes out.
                    </FieldDescription>
                </FieldContent>
                <Switch
                    id="builder-beta"
                    checked={channel === 'beta'}
                    onCheckedChange={(on: boolean): void =>
                        setChannel(on ? 'beta' : 'stable')
                    }
                />
            </Field>
        </FieldLabel>
    )
}

export function AboutSection(): JSX.Element {
    const [checking, setChecking] = useState(false)
    const api = getApi()
    const isElectron = isElectronEnv()

    const handleCheckUpdates = async (): Promise<void> => {
        if (!api) return
        setChecking(true)
        try {
            const result = (await api.invoke(
                IpcChannels.UPDATES_CHECK,
            )) as UpdateCheckResultPayload
            if (result.status === 'newer' && result.version) {
                toast.success(`Update available: v${result.version}`, {
                    description:
                        'A toast with download options should appear shortly.',
                })
            } else if (result.status === 'current') {
                toast.success('You are on the latest version', {
                    description: `Remappr v${APP_VERSION} is up to date.`,
                })
            } else {
                toast.error('Could not check for updates', {
                    description: result.error ?? 'Unknown error',
                })
            }
        } catch (e) {
            // Fire-and-forget onClick handler — a rejected IPC invoke would
            // otherwise surface as an unhandled rejection with no user feedback.
            toast.error('Could not check for updates', {
                description: e instanceof Error ? e.message : String(e),
            })
        } finally {
            setChecking(false)
        }
    }

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold">About</h3>
            <p className="text-sm">
                Remappr <span className="font-mono">v{APP_VERSION}</span>
            </p>
            <div className="flex flex-wrap gap-2">
                <DownloadLatestButton />
                <Button
                    variant="ghost"
                    onClick={(): void => void openCurrentReleaseNotes()}
                >
                    <Sparkles className="mr-2 h-4 w-4" />
                    What’s new
                </Button>
                {isElectron && (
                    <Button
                        variant="ghost"
                        onClick={handleCheckUpdates}
                        disabled={checking}
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 ${
                                checking ? 'animate-spin' : ''
                            }`}
                        />
                        {checking ? 'Checking…' : 'Check for updates'}
                    </Button>
                )}
            </div>
            <BuilderChannelField />
        </div>
    )
}
