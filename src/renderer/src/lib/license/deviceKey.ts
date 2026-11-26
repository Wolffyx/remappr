// pattern-check: skip — one IndexedDB-backed key accessor plus a sign helper.
//
// This device's identity for builder licenses: an ECDSA P-256 key pair made
// once, with a NON-extractable private key kept in IndexedDB (the browser
// stores the key object itself; its bytes can never be read out). The license
// names sha256(SPKI of the public key), so a copied license is useless
// without this browser profile's key.

const DB_NAME = 'remappr-license'
const STORE = 'keys'
const DEVICE_KEY = 'device'

export interface DeviceKey {
    /** SPKI of the public key, base64url. */
    publicKey: string
    /** sha256(SPKI) hex — the `dev` the license names. */
    hash: string
    /** ECDSA P-256 / SHA-256 signature (raw r||s), base64url. */
    sign(message: string): Promise<string>
}

function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

function openDb(): Promise<IDBDatabase> {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    return request(req)
}

export function b64url(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function loadOrCreatePair(): Promise<CryptoKeyPair> {
    const db = await openDb()
    const stored = await request(
        db.transaction(STORE).objectStore(STORE).get(DEVICE_KEY) as IDBRequest<
            CryptoKeyPair | undefined
        >,
    )
    if (stored) return stored
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
    )
    await request(
        db
            .transaction(STORE, 'readwrite')
            .objectStore(STORE)
            .put(pair, DEVICE_KEY),
    )
    return pair
}

let pending: Promise<DeviceKey> | null = null

/** This device's key (made on first use). */
export function getDeviceKey(): Promise<DeviceKey> {
    pending ??= (async () => {
        const pair = await loadOrCreatePair()
        const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
        return {
            publicKey: b64url(new Uint8Array(spki)),
            hash: await sha256Hex(spki),
            sign: async (message) => {
                const sig = await crypto.subtle.sign(
                    { name: 'ECDSA', hash: 'SHA-256' },
                    pair.privateKey,
                    new TextEncoder().encode(message),
                )
                return b64url(new Uint8Array(sig))
            },
        }
    })()
    return pending
}
