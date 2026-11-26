// pattern-check: skip — two one-line conversions moved out of KeycodeField
// Dynamic entries store keycodes as raw HID usages (keyboard page implied), while
// the picker + HidUsageLabel speak the codec's packed (page<<16)|usage. Convert at
// the boundary — same rule as dynamicBridge's keyOfUsage / usageOfKey (&0xffff).
const HID_PAGE_KEYBOARD = 0x07

export const rawToPacked = (raw: number): number =>
    raw > 0 && raw < 1 << 16 ? (HID_PAGE_KEYBOARD << 16) | raw : raw

export const packedToRaw = (packed?: number): number => (packed ?? 0) & 0xffff
