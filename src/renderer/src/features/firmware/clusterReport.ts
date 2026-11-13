// pattern-check: skip — pure text formatter for the cluster diagnostics "Copy for support" button
import type { ClusterDiag } from '@firmware'

export const hex2 = (n: number): string =>
    `0x${n.toString(16).padStart(2, '0')}`

/** The raw values as plain text, for "Copy for support". */
export function diagReport(diag: ClusterDiag): string {
    const row = (cells: (string | number)[]): string => cells.join('\t')
    return [
        row(['node', 'role', 'up', 'seen', 'round', 'flags']),
        row([
            'this',
            diag.coordinator ? 'main' : 'follower',
            '-',
            '-',
            diag.localTerm,
            hex2(diag.localFlags),
        ]),
        ...diag.peers.map((p, i) =>
            row([
                `port ${i}`,
                p.coordinator ? 'main' : 'follower',
                p.ready ? 'yes' : 'no',
                p.seen ? 'yes' : 'no',
                p.term,
                hex2(p.hbFlags),
            ]),
        ),
    ].join('\n')
}
