// pattern-check: skip — small presentational component, no abstraction warranted
import { ExternalLink } from '@/components/ExternalLink'
import useConnectionStore from '@/stores/connectionStore'
import { Lock } from 'lucide-react'

export const LockedOverlay = (): JSX.Element => {
    // Firmwares whose unlock has a prerequisite the user must set up themselves
    // supply the extra guidance (see Capabilities.unlockHint). The app renders
    // whatever it is given and knows no firmware's documentation.
    const hint = useConnectionStore((s) => s.service?.capabilities.unlockHint)

    return (
        <div className="flex h-full w-full items-center justify-center bg-background p-6">
            <div className="max-w-md space-y-4 rounded-lg border bg-card p-8 shadow-lg">
                <div className="flex items-center gap-3">
                    <Lock className="h-6 w-6 text-primary" aria-hidden />
                    <h2 className="text-xl font-semibold">
                        Unlock To Continue
                    </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    For security reasons, your device requires unlocking before
                    using Remappr.
                </p>
                {hint && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{hint.message}</p>
                        {hint.docsUrl && (
                            <p>
                                <ExternalLink href={hint.docsUrl}>
                                    {hint.docsLabel ?? 'Documentation'}
                                </ExternalLink>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
