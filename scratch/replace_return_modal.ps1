$adminHtml = "admin.html"
$content = Get-Content $adminHtml -Raw -Encoding UTF8

$startMarker = '    <div id="returnModal"'
$endMarker   = '    <!-- MODAL (Party Ledger)'

$startIdx = $content.IndexOf($startMarker)
$endIdx   = $content.IndexOf($endMarker)

if ($startIdx -lt 0 -or $endIdx -lt 0) {
    Write-Error "Markers not found! start=$startIdx end=$endIdx"; exit 1
}

$newModal = @'
    <div id="returnModal" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;z-index:3000;">
        <div class="glass-card" style="width:98%;max-width:1380px;padding:1.25rem 1.75rem;max-height:96vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:0;font-family:'Inter',sans-serif;">

            <!-- ── Header ─────────────────────────────────────────── -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;border-bottom:1px solid var(--glass-border);padding-bottom:0.75rem;">
                <div>
                    <div id="return-module-badge" style="font-size:0.55rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:3px;">CREDIT NOTE</div>
                    <div id="return-modal-title" style="font-size:0.95rem;font-weight:700;color:#e2e8f0;letter-spacing:-0.02em;">Sale Return — Credit Note</div>
                </div>
                <button class="btn btn-ghost" onclick="closeReturnModal()" style="padding:5px 12px;font-size:0.72rem;opacity:0.7;">✕ Close</button>
            </div>

            <!-- ── 3-Action Tabs ───────────────────────────────────── -->
            <div id="return-action-tabs" style="display:flex;gap:5px;margin-bottom:1rem;background:rgba(0,0,0,0.3);padding:4px;border-radius:8px;width:fit-content;"></div>

            <form id="returnForm" onsubmit="saveMultiItemReturn(event)" style="display:flex;flex-direction:column;flex:1;">
                <input type="hidden" id="return-reason">
                <input type="hidden" id="return-note-type">

                <!-- ── Header Fields ─────────────────────────────── -->
                <div style="display:grid;grid-template-columns:2.2fr 1fr 1fr;gap:0.85rem;margin-bottom:0.85rem;">
                    <div>
                        <label style="display:block;font-size:0.6rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Party / Stockist</label>
                        <select id="return-party" required onchange="updateNotePartyDetails(this.value,'return-party-info')" style="width:100%;font-size:0.78rem;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#e2e8f0;"></select>
                        <div id="return-party-info" style="font-size:0.6rem;color:var(--accent);margin-top:3px;min-height:0.8rem;"></div>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.6rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Ref Invoice No</label>
                        <input type="text" id="return-inv-no" placeholder="e.g. INV-1023" style="width:100%;font-size:0.78rem;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#e2e8f0;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-size:0.6rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Invoice Date</label>
                        <input type="text" id="return-inv-date" placeholder="DD-MM-YYYY" style="width:100%;font-size:0.78rem;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#e2e8f0;box-sizing:border-box;">
                    </div>
                </div>

                <!-- ── Items Table ────────────────────────────────── -->
                <div style="flex:1;border:1px solid rgba(99,102,241,0.15);border-radius:10px;overflow:hidden;background:rgba(6,12,24,0.6);margin-bottom:0.75rem;">
                    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                        <colgroup>
                            <col style="width:24%"><!-- Product -->
                            <col style="width:6%"><!-- HSN -->
                            <col style="width:9%"><!-- Batch -->
                            <col style="width:6%"><!-- Month -->
                            <col style="width:6%"><!-- Year -->
                            <col style="width:5%"><!-- Qty -->
                            <col style="width:9%"><!-- Price -->
                            <col style="width:5%"><!-- GST% -->
                            <col style="width:10%"><!-- Total -->
                            <col style="width:3%"><!-- Del -->
                        </colgroup>
                        <thead>
                            <tr style="background:rgba(99,102,241,0.1);border-bottom:1px solid rgba(99,102,241,0.2);">
                                <th style="padding:6px 8px;text-align:left;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Product</th>
                                <th style="padding:6px 5px;text-align:left;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">HSN</th>
                                <th style="padding:6px 5px;text-align:left;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Batch No</th>
                                <th style="padding:6px 5px;text-align:center;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Mon</th>
                                <th style="padding:6px 5px;text-align:center;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Year</th>
                                <th style="padding:6px 5px;text-align:center;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Qty</th>
                                <th style="padding:6px 5px;text-align:right;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Price</th>
                                <th style="padding:6px 5px;text-align:center;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">GST%</th>
                                <th style="padding:6px 8px;text-align:right;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="return-items-body"></tbody>
                    </table>
                </div>

                <!-- ── Totals Row + Add Button ─────────────────────── -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.85rem;">
                    <button type="button" onclick="addReturnRow()" style="background:transparent;border:1px dashed rgba(99,102,241,0.35);color:var(--primary);padding:5px 14px;border-radius:7px;font-size:0.68rem;font-weight:800;cursor:pointer;letter-spacing:0.05em;transition:all 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.1)'" onmouseout="this.style.background='transparent'">＋ ADD ITEM</button>
                    <div style="display:flex;align-items:center;gap:1.2rem;background:rgba(0,0,0,0.4);padding:8px 16px;border-radius:9px;border:1px solid rgba(255,255,255,0.06);">
                        <div style="text-align:right;">
                            <div style="font-size:0.52rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin-bottom:2px;">Subtotal</div>
                            <div id="return-subtotal" style="font-size:0.75rem;font-weight:700;color:#94a3b8;font-family:monospace;">₹0.00</div>
                        </div>
                        <span style="color:#334155;font-size:0.65rem;">+</span>
                        <div style="text-align:right;">
                            <div style="font-size:0.52rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin-bottom:2px;">GST</div>
                            <div id="return-gst" style="font-size:0.75rem;font-weight:700;color:#94a3b8;font-family:monospace;">₹0.00</div>
                        </div>
                        <span style="color:#334155;font-size:0.65rem;">±</span>
                        <div style="text-align:right;">
                            <div style="font-size:0.52rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#475569;margin-bottom:2px;">Round Off</div>
                            <div id="return-roundoff" style="font-size:0.75rem;font-weight:700;color:#64748b;font-family:monospace;">₹0.00</div>
                        </div>
                        <div style="width:1px;height:28px;background:rgba(255,255,255,0.07);"></div>
                        <div style="text-align:right;">
                            <div style="font-size:0.52rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);margin-bottom:2px;">Grand Total</div>
                            <div id="return-total" style="font-size:1.05rem;font-weight:900;color:var(--primary);font-family:monospace;">₹0.00</div>
                        </div>
                    </div>
                </div>

                <!-- ── Footer Actions ──────────────────────────────── -->
                <div style="display:flex;justify-content:flex-end;align-items:center;gap:0.6rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.06);">
                    <button type="button" onclick="closeReturnModal()" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#64748b;padding:7px 18px;border-radius:7px;font-size:0.7rem;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.04em;">✕ CANCEL</button>
                    <button type="submit" id="return-submit-btn" style="background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;border:none;padding:7px 22px;border-radius:7px;font-size:0.72rem;font-weight:900;cursor:pointer;letter-spacing:0.06em;transition:all 0.2s;box-shadow:0 4px 14px rgba(99,102,241,0.35);">✓ POST RETURN &amp; GENERATE CN</button>
                </div>
            </form>
        </div>
    </div>

'@

$before = $content.Substring(0, $startIdx)
$after  = $content.Substring($endIdx)
$newContent = $before + $newModal + $after

[System.IO.File]::WriteAllText((Resolve-Path $adminHtml), $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done. File written successfully."
