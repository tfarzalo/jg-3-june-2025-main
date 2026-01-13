## Scope
- Display rate and quantity/hours for each extra charge line item on the Extra Charges Approval page and in the downloadable PDF.
- Preserve current line-item layout and totals; add clear "Rate" info everywhere items are shown.

## Files To Update (Page)
- Details card: [ApprovalDetailsCard.tsx](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/components/approval/ApprovalDetailsCard.tsx#L86-L114)
- Approved state list: [ApprovalPage.tsx (approved view)](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/pages/ApprovalPage.tsx#L583-L627)
- Declined state list: [ApprovalPage.tsx (declined view)](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/pages/ApprovalPage.tsx#L687-L731)

## Files To Update (PDF)
- Add Rate column and support quantity/unit in: [generateApprovalPDF.ts](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/utils/generateApprovalPDF.ts#L17-L24) (extend item type) and table build: [generateApprovalPDF.ts table](file:///Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main/src/utils/generateApprovalPDF.ts#L129-L139).

## UI & PDF Logic
- Show sub-lines under description:
  - Qty (if available): "📦 {quantity} {unit || 'items'}"
  - Hours (if available): "⏱️ {hours} hour(s)"
  - Rate line:
    - If hours > 0: "Rate: ${cost/hours}/hr"
    - Else if quantity > 0: "Rate: ${cost/quantity} per {unit || 'item'}"
    - Hide rate if no divisor or divisor is 0.
- PDF table columns: Description | Qty/Hrs | Rate | Amount
  - Qty/Hrs cell: same construction as page
  - Rate cell: computed as above; "-" when not applicable
  - Amount: existing ${cost}

## Types/Data
- Extend PDF ExtraChargesData.items to include quantity?: number and unit?: string (to match token payload used by the page).
- No backend changes required; all values are derived client-side.

## Implementation Notes
- Currency display uses toFixed(2).
- Prefer hours-based rate when hours is provided; otherwise use quantity-based.
- Guard against undefined/zero to avoid division errors.
- Maintain existing styling classes: use "text-xs text-gray-500" for the rate sub-line.

## Validation
- Load approval token with items using hours and items using quantity to verify:
  - Page shows description, qty/hours, rate, amount for each item.
  - Approved and Declined views render consistently.
  - PDF downloads include a Rate column with correct values; totals unchanged.

## Acceptance Criteria
- Both the approval page and the downloadable PDF clearly show, for each line item: description, quantity or hours, rate being charged, and line amount.
- Totals and layout remain unchanged aside from the added rate information.