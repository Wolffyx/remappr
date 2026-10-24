// pattern-check: skip — unit test for the cluster diagnostics support report.
import { describe, expect, it } from 'vitest'
import type { ClusterDiag } from '@firmware'

import { diagReport } from './clusterReport'

describe('diagReport', () => {
    it('lists this node and every peer as tab-separated rows', () => {
        const diag = {
            coordinator: true,
            localTerm: 3,
            localFlags: 5,
            peers: [
                {
                    coordinator: false,
                    ready: true,
                    seen: true,
                    term: 3,
                    hbFlags: 1,
                },
                {
                    coordinator: false,
                    ready: false,
                    seen: false,
                    term: 0,
                    hbFlags: 0,
                },
            ],
        } as unknown as ClusterDiag
        expect(diagReport(diag).split('\n')).toEqual([
            'node\trole\tup\tseen\tround\tflags',
            'this\tmain\t-\t-\t3\t0x05',
            'port 0\tfollower\tyes\tyes\t3\t0x01',
            'port 1\tfollower\tno\tno\t0\t0x00',
        ])
    })
})
