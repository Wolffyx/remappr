// pattern-check: skip — tab shell over the three existing cluster panels
//
// One Cluster dialog instead of three header icons for one subsystem: Status
// (live role and transitions), Role (this node's role, forwarding and the
// position map) and Link (bus latency, election cadence, power tier). Each tab
// shows only when the connected firmware offers it.
import { useState } from 'react'
import { Network } from 'lucide-react'

import { Modal } from '@/ui/modal'
import { Segmented } from '@/ui/segmented'
import useConnectionStore from '@/stores/connectionStore'
import { FEATURE_PROBES } from './useFeatureAvailable'
import { ClusterDiagnosticsModal } from './ClusterDiagnosticsModal'
import { NodeConfigModal } from './NodeConfigModal'
import { LinkProfileModal } from './LinkProfileModal'
import { TabFrame } from './clusterFrame'

type ClusterTab = 'status' | 'role' | 'link'

const TABS: readonly {
    value: ClusterTab
    label: string
    feature: 'cluster' | 'limits'
}[] = [
    { value: 'status', label: 'Status', feature: 'cluster' },
    { value: 'role', label: 'Role', feature: 'limits' },
    { value: 'link', label: 'Link', feature: 'limits' },
]

const PANELS = {
    status: ClusterDiagnosticsModal,
    role: NodeConfigModal,
    link: LinkProfileModal,
} satisfies Record<ClusterTab, unknown>

export function ClusterModal({
    opened,
    onClose,
}: {
    opened: boolean
    onClose: () => void
}): JSX.Element {
    const service = useConnectionStore((s) => s.service)
    const tabs = TABS.filter(
        (t) => !!service && !!FEATURE_PROBES[t.feature](service),
    )
    const [picked, setPicked] = useState<ClusterTab>('status')
    const tab = tabs.some((t) => t.value === picked)
        ? picked
        : (tabs[0]?.value ?? 'status')

    return (
        <Modal
            size="lg"
            opened={opened}
            onClose={onClose}
            title="Cluster"
            subtitle="Every node on the bus: status, role and link"
            headerIcon={<Network />}
            showFooter={false}
        >
            <div className="flex flex-col gap-4">
                {tabs.length > 1 && (
                    <Segmented
                        value={tab}
                        options={tabs.map(({ value, label }) => ({
                            value,
                            label,
                        }))}
                        onChange={setPicked}
                        label="Cluster view"
                    />
                )}
                {/* Every tab stays mounted so an unsaved Role or Link edit
                    survives a look at another tab. */}
                {tabs.map(({ value }) => {
                    const Panel = PANELS[value]
                    return (
                        <div key={value} hidden={value !== tab}>
                            <Panel
                                opened={opened}
                                onClose={onClose}
                                frame={TabFrame}
                            />
                        </div>
                    )
                })}
            </div>
        </Modal>
    )
}
