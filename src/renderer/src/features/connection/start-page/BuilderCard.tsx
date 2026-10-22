// Pattern check: no GoF pattern (-) — rejected — presentational start-page CTA
// banner gated on builder access; opens the full-screen builder via builderStore.
//
// The "Create a keyboard" entry, ported 1:1 from the design prototype's
// full-width gradient banner. The builder is a premium feature, but during the
// alpha/beta pre-release it's FREE for everyone — useBuilderAccess() returns true,
// so the CTA always opens it. The badge/copy say "<stage> · free" and flag that
// monetization (account sign-in) lands at GA, once it's fully working across every
// firmware. At GA, access falls back to the premium entitlement and this toasts
// the locked state instead. Opening flips builderStore.open; App swaps the start
// page for the full-screen <Builder/>.
import { ArrowRight, Lock, Ruler, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useBuilderAccess, useBuilderStage } from '@/hooks/use-premium'
import useBuilderStore from '@/stores/builderStore'

export function BuilderCard(): JSX.Element {
    const access = useBuilderAccess()
    const stage = useBuilderStage()
    const free = stage !== 'ga'
    const setOpen = useBuilderStore((s) => s.setOpen)

    const onOpen = (): void => {
        if (!access) {
            toast.info('The keyboard builder is a premium feature', {
                description:
                    'Sign in to an account to unlock it once monetization is live.',
            })
            return
        }
        if (free) {
            toast.info(`Welcome to the builder ${stage}`, {
                description:
                    'Free while in alpha & beta. It becomes a premium feature (account required) once it fully supports every firmware.',
            })
        }
        setOpen(true)
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group mt-4 flex w-full items-center gap-4 rounded-2xl border px-[18px] py-4 text-left text-foreground transition-all hover:-translate-y-0.5"
            style={{
                background:
                    'linear-gradient(100deg, color-mix(in oklab, var(--primary) 16%, var(--card)), var(--card) 70%)',
                borderColor:
                    'color-mix(in oklab, var(--primary) 38%, var(--border))',
            }}
        >
            <span
                className="grid size-[46px] shrink-0 place-items-center rounded-xl text-primary-foreground"
                style={{
                    background:
                        'linear-gradient(150deg, var(--primary), color-mix(in oklab, var(--primary) 65%, #000))',
                }}
            >
                <Ruler size={22} />
            </span>
            <div className="flex-1">
                <div className="flex items-center gap-2.5">
                    <span className="text-[15.5px] font-bold">
                        Create a keyboard
                    </span>
                    <span
                        className="rounded-full px-[7px] py-0.5 text-meta font-bold text-primary"
                        style={{
                            background:
                                'color-mix(in oklab, var(--primary) 16%, transparent)',
                        }}
                    >
                        BUILDER
                    </span>
                    {free && (
                        <span
                            className="inline-flex items-center gap-1 rounded-full px-[7px] py-0.5 text-meta font-bold uppercase text-success"
                            style={{
                                background:
                                    'color-mix(in oklab, var(--primary) 10%, transparent)',
                            }}
                        >
                            <Sparkles size={10} /> {stage} · FREE
                        </span>
                    )}
                </div>
                <div className="mt-1 text-panel-title text-muted-foreground">
                    Design a board from scratch — layout, matrix &amp; firmware.
                    Import KLE, start from a preset, then export a build-ready
                    config.
                    {free ? (
                        <>
                            {' '}
                            <span className="text-foreground/80">
                                Premium feature — free during alpha &amp; beta.
                                Once it fully supports every firmware it&apos;ll
                                require an account.
                            </span>
                        </>
                    ) : null}
                </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-panel-title font-semibold text-primary-foreground">
                {access ? (
                    <>
                        Open builder <ArrowRight size={15} />
                    </>
                ) : (
                    <>
                        <Lock size={14} /> Premium
                    </>
                )}
            </span>
        </button>
    )
}
