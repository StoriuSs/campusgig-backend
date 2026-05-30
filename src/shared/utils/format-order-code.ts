// Derives the user-facing order code from the monotonic `number` SERIAL.
// Locked in 09-order-workspace-and-lifecycle spec § Decisions log:
//   order 1     → 'CG-0001'
//   order 42    → 'CG-0042'
//   order 12345 → 'CG-12345' (auto-grows past 4 digits, no padding loss)
// Mirror on the frontend lives at campusgig-frontend/src/utils/orders.ts.
export function formatOrderCode(n: number): string {
    return `CG-${String(n).padStart(4, '0')}`
}
