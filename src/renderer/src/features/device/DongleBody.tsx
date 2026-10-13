// Pattern check: no GoF pattern (-) — rejected — layout wrapper: the roster
// alone, or the roster and the settings panel as two tabs.
import type { JSX, ReactNode } from 'react'
import { Cpu, Settings2 } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

/** The dongle page body: `children` (the node roster) alone, or — when the
 *  dongle has its own settings — the roster and `settings` as tabs. */
export function DongleBody({
    settings,
    children,
}: {
    settings?: ReactNode
    children: ReactNode
}): JSX.Element {
    if (!settings) return <>{children}</>
    return (
        <Tabs defaultValue="nodes">
            <TabsList>
                <TabsTrigger value="nodes">
                    <Cpu className="mr-1.5 size-3.5" />
                    Nodes
                </TabsTrigger>
                <TabsTrigger value="settings">
                    <Settings2 className="mr-1.5 size-3.5" />
                    Settings
                </TabsTrigger>
            </TabsList>
            <TabsContent value="nodes" className="mt-4">
                {children}
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
                {settings}
            </TabsContent>
        </Tabs>
    )
}
