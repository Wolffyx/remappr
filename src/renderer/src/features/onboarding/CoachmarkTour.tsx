// Pattern check: no GoF pattern (-) — rejected — first-run spotlight tour stepping over
// data-coach target rects with a tooltip card, persisted once in localStorage. Effect +
// render logic, no abstraction or polymorphism warranted.
import { useEffect, useLayoutEffect, useState } from 'react'
import { Button } from '@/ui/button'

const DONE_KEY = 'remappr-coach-done'

interface Step {
    // CSS selector of the element to spotlight; null = centred card, no spotlight.
    selector: string | null
    title: string
    body: string
}

const STEPS: Step[] = [
    {
        selector: '[data-coach="board"]',
        title: 'Your keyboard',
        body: 'Pan with a drag, zoom with the wheel, and click a key to edit it. Toggle the heatmap and live view from the toolbar above the board.',
    },
    {
        selector: '[data-coach="layers"]',
        title: 'Layers',
        body: 'Switch, add, rename, and reorder layers here. Hover a layer to peek it on the board.',
    },
    {
        selector: '[data-coach="tools"]',
        title: 'Tools',
        body: 'Every editing tool lives in this bar: view toggles, behaviors, lighting, device settings and firmware. Press / to search for any tool, and pick a toolbar style in Settings → Workspace.',
    },
    {
        selector: null,
        title: 'Workspaces',
        body: 'Prefer a side panel or a ⌘K command palette for assigning keys? Pick a workspace in Settings → Workspace.',
    },
]

interface Rect {
    top: number
    left: number
    width: number
    height: number
}

export function CoachmarkTour(): JSX.Element | null {
    const [active, setActive] = useState(false)
    const [step, setStep] = useState(0)
    const [rect, setRect] = useState<Rect | null>(null)

    useEffect(() => {
        if (localStorage.getItem(DONE_KEY)) return
        // Defer so the editor has mounted and the targets exist.
        const t = setTimeout(() => setActive(true), 600)
        return () => clearTimeout(t)
    }, [])

    const current = STEPS[step]

    useLayoutEffect(() => {
        if (!active) return
        const measure = (): void => {
            if (!current.selector) {
                setRect(null)
                return
            }
            const el = document.querySelector(current.selector)
            if (!el) {
                setRect(null)
                return
            }
            const r = el.getBoundingClientRect()
            setRect({
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
            })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [active, step, current.selector])

    if (!active) return null

    const finish = (): void => {
        localStorage.setItem(DONE_KEY, '1')
        setActive(false)
    }
    const isLast = step === STEPS.length - 1
    const next = (): void => (isLast ? finish() : setStep((s) => s + 1))
    const back = (): void => setStep((s) => Math.max(0, s - 1))

    // Spotlight padding around the target.
    const pad = 6
    const spot = rect
        ? {
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
          }
        : null

    // Position the card near the target (below if room, else above); centred otherwise.
    const cardStyle: React.CSSProperties = spot
        ? spot.top + spot.height + 220 < window.innerHeight
            ? {
                  top: spot.top + spot.height + 12,
                  left: Math.min(
                      Math.max(12, spot.left),
                      window.innerWidth - 332,
                  ),
              }
            : {
                  top: Math.max(12, spot.top - 200),
                  left: Math.min(
                      Math.max(12, spot.left),
                      window.innerWidth - 332,
                  ),
              }
        : {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
          }

    return (
        <div className="fixed inset-0 z-[2000]">
            {/* Click-blocker (transparent) so the app is paused during the tour. */}
            <div className="absolute inset-0" />
            {spot ? (
                <div
                    aria-hidden
                    className="absolute rounded-lg"
                    style={{
                        ...spot,
                        boxShadow:
                            '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px var(--primary)',
                        pointerEvents: 'none',
                        transition: 'all 0.2s ease',
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-black/60" />
            )}
            <div
                className="absolute w-80 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
                style={cardStyle}
            >
                <div className="text-sm font-semibold">{current.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {current.body}
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {step + 1} / {STEPS.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={finish}>
                            Skip
                        </Button>
                        {step > 0 && (
                            <Button variant="outline" size="sm" onClick={back}>
                                Back
                            </Button>
                        )}
                        <Button size="sm" onClick={next}>
                            {isLast ? 'Done' : 'Next'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
