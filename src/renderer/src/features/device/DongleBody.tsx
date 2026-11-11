// Pattern check: no GoF pattern (-) — rejected — layout wrapper: the roster
// alone, or the roster beside the radio and settings panels as tabs.
import type { JSX, ReactNode } from 'react'
import { Cpu, Radio, Settings2 } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

/** The dongle page body: `children` (the node roster) alone, or — when the
 *  dongle has radio channels or its own settings to show — the roster beside
 *  `radio` and `settings` as tabs. */
export function DongleBody({
    settings,
    radio,
    children,
}: {
    settings?: ReactNode
    radio?: ReactNode
    children: ReactNode
}): JSX.Element {
    if (!settings && !radio) return <>{children}</>
    return (
        <Tabs defaultValue="nodes">
            <TabsList>
                <TabsTrigger value="nodes">
                    <Cpu className="mr-1.5 size-3.5" />
                    Nodes
                </TabsTrigger>
                {radio && (
                    <TabsTrigger value="radio">
                        <Radio className="mr-1.5 size-3.5" />
                        Radio
                    </TabsTrigger>
                )}
                {settings && (
                    <TabsTrigger value="settings">
                        <Settings2 className="mr-1.5 size-3.5" />
                        Settings
                    </TabsTrigger>
                )}
            </TabsList>
            <TabsContent value="nodes" className="mt-4">
                {children}
            </TabsContent>
            {radio && (
                <TabsContent value="radio" className="mt-4">
                    {radio}
                </TabsContent>
            )}
            {settings && (
                <TabsContent value="settings" className="mt-4">
                    {settings}
                </TabsContent>
            )}
        </Tabs>
    )
}
