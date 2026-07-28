// Pattern check: no GoF pattern (-) — rejected — presentational modal listing
// external donation links; no abstraction or polymorphism warranted.
import { useState } from 'react'
// HandHeart + OPENCOLLECTIVE_URL re-added when the Open Collective row below is re-enabled.
import { Coffee, Heart } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { GitHubIcon } from '@/components/GitHubIcon'
import { GITHUB_SPONSORS_URL, KOFI_URL } from '@/lib/constants'

interface SupportOption {
    name: string
    blurb: string
    url: string
    icon: JSX.Element
}

const OPTIONS: SupportOption[] = [
    {
        name: 'GitHub Sponsors',
        blurb: 'Sponsor development directly on GitHub.',
        url: GITHUB_SPONSORS_URL,
        icon: <GitHubIcon className="h-5 w-5" />,
    },
    {
        name: 'Ko-fi',
        blurb: 'Buy the project a coffee — one-off or monthly.',
        url: KOFI_URL,
        icon: <Coffee className="h-5 w-5" />,
    },
    // {
    //     name: 'Open Collective',
    //     blurb: 'Back the project transparently as a collective.',
    //     url: OPENCOLLECTIVE_URL,
    //     icon: <HandHeart className="h-5 w-5" />,
    // },
]

/**
 * Header entry point for donations. Renders its own trigger button (so it can be
 * dropped into the header link cluster) and a controlled dialog listing every
 * donation platform as an external link. Links open in the system browser in
 * both web and Electron via the main-process setWindowOpenHandler.
 */
export function SupportModal(): JSX.Element {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Support this project"
                onClick={(): void => setOpen(true)}
            >
                <Heart className="h-4 w-4" />
            </Button>

            <Modal
                opened={open}
                onClose={(): void => setOpen(false)}
                title="Support this project"
                subtitle="Help keep Remappr free and open-source"
                headerIcon={<Heart />}
                customModalBoxClass="w-11/12 max-w-md"
                close="Close"
                success={false}
            >
                <div className="flex flex-col gap-2 py-2">
                    {OPTIONS.map((opt) => (
                        <Button
                            key={opt.name}
                            variant="outline"
                            asChild
                            className="h-auto justify-start gap-3 px-3 py-3 text-left"
                        >
                            <a
                                href={opt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/15 text-primary">
                                    {opt.icon}
                                </span>
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold">
                                        {opt.name}
                                    </span>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {opt.blurb}
                                    </span>
                                </span>
                            </a>
                        </Button>
                    ))}
                </div>
            </Modal>
        </>
    )
}
