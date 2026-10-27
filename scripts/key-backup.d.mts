// pattern-check: skip — types for scripts/key-backup.mjs (used by its tests).
export interface BackupInput {
    env: string
    ref: string
    publicKeys: Record<string, string>
    secrets: Record<string, string>
}
export interface SealedBackup {
    format: string
    v: number
    env: string
    ref: string
    publicKeys: Record<string, string>
    createdAt: string
    kdf: {
        name: string
        N: number
        r: number
        p: number
        keylen: number
        salt: string
    }
    cipher: string
    iv: string
    tag: string
    data: string
}
export const DEFAULT_BACKUP_DIR: string
export function encryptBackup(
    input: BackupInput,
    passphrase: string,
): SealedBackup
export function decryptBackup(
    backup: SealedBackup,
    passphrase: string,
): Record<string, string>
export function backupDir(repoRoot: string, wanted?: string): string
export function writeBackup(dir: string, backup: SealedBackup): string
export function readBackup(file: string): SealedBackup
export function askPassphrase(
    prompt: string,
    options?: { confirm?: boolean },
): Promise<string>
