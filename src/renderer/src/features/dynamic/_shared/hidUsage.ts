// pattern-check: skip — two pure conversion helpers shared by the keycode field and the macro summary
const HID_PAGE_KEYBOARD = 0x07

// Dynamic entries store keycodes as raw HID usages (keyboard page implied), while
// the picker + HidUsageLabel speak the codec's packed (page<<16)|usage. Convert at
// the boundary — same rule as dynamicBridge's keyOfUsage / usageOfKey (&0xffff).
export const rawToPacked = (raw: number): number =>
    raw > 0 && raw < 1 << 16 ? (HID_PAGE_KEYBOARD << 16) | raw : raw
export const packedToRaw = (packed?: number): number => (packed ?? 0) & 0xffff
