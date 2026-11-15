// pattern-check: skip — presentational card, no abstraction
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
    title: string
    description: string
    action: ReactNode
    icon?: LucideIcon
}

/** Start-page feature card, ported 1:1 from the design prototype: solid card,
 *  primary-tinted icon box, centered title/body, action pinned to the bottom. */
export function FeatureCard({
    title,
    description,
    action,
    icon: Icon,
}: FeatureCardProps): JSX.Element {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-5 text-center">
            {Icon && (
                <div
                    className="mb-3 grid size-10 place-items-center rounded-lg text-primary"
                    style={{
                        background:
                            'color-mix(in oklab, var(--primary) 12%, transparent)',
                    }}
                >
                    <Icon size={20} />
                </div>
            )}
            <div className="text-brand font-bold">{title}</div>
            <p className="mx-0 mb-4 mt-1.5 text-panel-title leading-normal text-muted-foreground">
                {description}
            </p>
            <div className="mt-auto">{action}</div>
        </div>
    )
}
