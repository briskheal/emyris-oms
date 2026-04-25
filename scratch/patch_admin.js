const fs = require('fs');
let content = fs.readFileSync('admin.html', 'utf-8');

const START = '<!-- SPECIMEN INVOICE STYLE -->';
const END = '<input type="hidden" id="set-inv-style" value="classic">\n                        </div>';

const si = content.indexOf(START);
const ei = content.indexOf(END) + END.length;

const REPLACEMENT = `<!-- SPECIMEN INVOICE STYLE -->
                        <div class="glass-card" style="grid-column: span 2; padding: 2rem; border-top: 4px solid var(--primary);">
                            <h3 class="section-title">📄 Invoice Template — Specimen Selection</h3>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 2rem;">Click to select your GST-approved invoice layout. The chosen template will be used for all PDF invoices generated from <strong style="color:var(--accent);">Accounting &amp; Invoices</strong> tab.</p>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">
                                
                                <!-- CLASSIC SPECIMEN -->
                                <div id="specimen-classic" onclick="setInvoiceStyle('classic')" style="cursor:pointer; border: 2px solid var(--primary); border-radius: 16px; overflow: hidden; transition: all 0.3s; box-shadow: 0 0 20px rgba(99,102,241,0.3);">
                                    <div style="background: var(--grad-primary); padding: 8px 12px; display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:800; font-size:0.75rem; color:#fff;">✅ CLASSIC PHARMA</span>
                                        <span id="check-classic" style="font-size:0.65rem; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:20px; color:#fff;">SELECTED</span>
                                    </div>
                                    <div style="padding: 10px; font-size: 0.55rem; color: #94a3b8; line-height: 1.6; background: rgba(15,23,42,0.6); font-family: monospace;">
                                        <div style="text-align:center; border-bottom: 1px dashed #334155; padding-bottom: 5px; margin-bottom:5px;">
                                            <div style="color:#fff; font-weight:800; font-size:0.7rem;">EMYRIS BIOLIFESCIENCES</div>
                                            <div>GST: 36AABCE1234F1Z5 | DL: TG-HYD-12345</div>
                                            <div>Ph: 7993163300 | www.emyrisbio.com</div>
                                        </div>
                                        <div style="text-align:center; color:#6366f1; font-weight:800; margin-bottom:4px; font-size:0.65rem; letter-spacing:1px;">TAX INVOICE</div>
                                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                                            <span>Invoice No: <b style="color:#fff;">EMY-INV-20260426-0001</b></span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                                            <span>Date: 26-04-2026</span><span>Due: 10-05-2026</span>
                                        </div>
                                        <div style="border: 1px solid #1e293b; margin: 4px 0; padding: 4px; border-radius:4px;">
                                            <div style="color:#fff; font-weight:700;">Bill To: ZIVA PHARMA</div>
                                            <div>GSTIN: 24LYGPS5699E1ZM | DL: DL-GJ-VAD-229377</div>
                                            <div>VADODARA, GUJARAT - 390019</div>
                                        </div>
                                        <table style="width:100%; font-size:0.48rem; border-collapse:collapse; margin-top:4px;">
                                            <tr style="background:#1e293b; color:#fff; text-align:center;">
                                                <th style="padding:2px; border:1px solid #334155;">Sl</th>
                                                <th style="padding:2px; border:1px solid #334155;">Product</th>
                                                <th style="padding:2px; border:1px solid #334155;">Qty</th>
                                                <th style="padding:2px; border:1px solid #334155;">Bonus</th>
                                                <th style="padding:2px; border:1px solid #334155;">Rate</th>
                                                <th style="padding:2px; border:1px solid #334155;">GST%</th>
                                                <th style="padding:2px; border:1px solid #334155;">Amt</th>
                                            </tr>
                                            <tr style="text-align:center;">
                                                <td style="border:1px solid #1e293b; padding:2px;">1</td>
                                                <td style="border:1px solid #1e293b; padding:2px; text-align:left;">EMYCAL-D3 10x10</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">10</td>
                                                <td style="border:1px solid #1e293b; padding:2px; color:#10b981;">0</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">₹2100</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">12%</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">₹23,520</td>
                                            </tr>
                                            <tr style="text-align:center;">
                                                <td style="border:1px solid #1e293b; padding:2px;">2</td>
                                                <td style="border:1px solid #1e293b; padding:2px; text-align:left;">EMYRIC B12 1x10</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">5</td>
                                                <td style="border:1px solid #1e293b; padding:2px; color:#10b981;">1</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">₹455</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">12%</td>
                                                <td style="border:1px solid #1e293b; padding:2px;">₹2,548</td>
                                            </tr>
                                        </table>
                                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px; padding-top:3px; border-top:1px dashed #334155;">
                                            <span>Taxable: ₹23,272</span> | <span>GST: ₹2,796</span> | <span style="color:#6366f1; font-weight:800;">Total: ₹26,068</span>
                                        </div>
                                        <div style="text-align:center; font-size:0.45rem; margin-top:3px; color:#475569; border-top:1px dashed #1e293b; padding-top:2px;">E.&O.E. — Subject to VADODARA Jurisdiction — Computer Generated Invoice</div>
                                    </div>
                                </div>

                                <!-- MODERN SPECIMEN -->
                                <div id="specimen-modern" onclick="setInvoiceStyle('modern')" style="cursor:pointer; border: 1px solid var(--glass-border); border-radius: 16px; overflow: hidden; transition: all 0.3s;">
                                    <div style="background: linear-gradient(135deg, #10b981, #0891b2); padding: 8px 12px; display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:800; font-size:0.75rem; color:#fff;">MODERN GLASS</span>
                                        <span id="check-modern" style="font-size:0.65rem; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:20px; color:#fff; display:none;">SELECTED</span>
                                    </div>
                                    <div style="padding: 10px; font-size: 0.55rem; color: #94a3b8; line-height: 1.6; background: rgba(15,23,42,0.6);">
                                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #10b981; padding-bottom:5px; margin-bottom:5px;">
                                            <div>
                                                <div style="color:#10b981; font-weight:900; font-size:0.8rem; letter-spacing:-0.5px;">EMYRIS</div>
                                                <div style="font-size:0.5rem; color:#94a3b8;">BIOLIFESCIENCES PVT. LTD.</div>
                                                <div style="font-size:0.45rem;">GST: 36AABCE1234F | www.emyrisbio.com</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div style="color:#fff; font-weight:800; font-size:0.65rem;">TAX INVOICE</div>
                                                <div style="color:#10b981; font-weight:700;">EMY-INV-20260426-0001</div>
                                                <div>Date: 26-04-2026</div>
                                            </div>
                                        </div>
                                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                                            <div style="background:rgba(16,185,129,0.08); padding:5px; border-radius:6px; border:1px solid rgba(16,185,129,0.2);">
                                                <div style="color:#10b981; font-size:0.45rem; font-weight:800; text-transform:uppercase; margin-bottom:2px;">Bill To</div>
                                                <div style="color:#fff; font-weight:700;">ZIVA PHARMA</div>
                                                <div>GSTIN: 24LYGPS5699E1ZM</div>
                                                <div>VADODARA, GUJARAT</div>
                                            </div>
                                            <div style="background:rgba(255,255,255,0.03); padding:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); text-align:right;">
                                                <div style="color:#10b981; font-size:0.45rem; font-weight:800; text-transform:uppercase; margin-bottom:2px;">Summary</div>
                                                <div>Taxable: ₹23,272</div>
                                                <div>GST (12%): ₹2,796</div>
                                                <div style="color:#10b981; font-weight:800; font-size:0.65rem;">Total: ₹26,068</div>
                                            </div>
                                        </div>
                                        <div style="background:rgba(16,185,129,0.05); border-radius:6px; padding:5px; border:1px solid rgba(16,185,129,0.1);">
                                            <div style="display:flex; justify-content:space-between; color:#fff; font-weight:700; font-size:0.48rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:2px; margin-bottom:3px;">
                                                <span style="flex:2;">Product</span><span>Qty</span><span>Bonus</span><span>Rate</span><span>Total</span>
                                            </div>
                                            <div style="display:flex; justify-content:space-between; font-size:0.48rem;">
                                                <span style="flex:2;">EMYCAL-D3</span><span>10</span><span style="color:#10b981;">+0</span><span>₹2,100</span><span>₹23,520</span>
                                            </div>
                                            <div style="display:flex; justify-content:space-between; font-size:0.48rem;">
                                                <span style="flex:2;">EMYRIC B12</span><span>5</span><span style="color:#10b981;">+1</span><span>₹455</span><span>₹2,548</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- COMPACT SPECIMEN -->
                                <div id="specimen-compact" onclick="setInvoiceStyle('compact')" style="cursor:pointer; border: 1px solid var(--glass-border); border-radius: 16px; overflow: hidden; transition: all 0.3s;">
                                    <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 8px 12px; display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:800; font-size:0.75rem; color:#fff;">COMPACT COMPLIANCE</span>
                                        <span id="check-compact" style="font-size:0.65rem; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:20px; color:#fff; display:none;">SELECTED</span>
                                    </div>
                                    <div style="padding: 10px; font-size: 0.52rem; color: #94a3b8; line-height: 1.5; background: rgba(15,23,42,0.6); font-family: monospace;">
                                        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                                            <b style="color:#fff; font-size:0.65rem;">EMYRIS BIOLIFESCIENCES</b>
                                            <span style="color:#f59e0b; font-weight:800;">TAX INVOICE</span>
                                        </div>
                                        <div style="border-bottom:1px solid #334155; border-top:1px solid #334155; margin:2px 0; padding:2px 0; display:flex; gap:6px; flex-wrap:wrap;">
                                            <span>GST:36AABCE1234F</span><span>DL:TG-HYD-12345</span><span>Ph:7993163300</span>
                                        </div>
                                        <div style="display:flex; gap:6px; margin:2px 0; flex-wrap:wrap;">
                                            <span>Inv: <b style="color:#fff;">EMY-0001</b></span>
                                            <span>Dt: 26-04-26</span>
                                            <span>Party: <b style="color:#10b981;">ZIVA PHARMA</b></span>
                                        </div>
                                        <div style="font-size:0.45rem; margin-bottom:3px;">
                                            GSTIN:24LYGPS5699E1ZM | DL:DL-GJ-VAD-229377 | VADODARA GJ
                                        </div>
                                        <table style="width:100%; font-size:0.45rem; border-collapse:collapse;">
                                            <tr style="background:#1e293b; color:#fff; text-align:center;">
                                                <th style="border:1px solid #334155; padding:1px 2px;">Sl</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Product</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">HSN</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Qty</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Bn</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Rate</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Txbl</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">GST</th>
                                                <th style="border:1px solid #334155; padding:1px 2px;">Amt</th>
                                            </tr>
                                            <tr style="text-align:center;">
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">1</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px; text-align:left;">EMYCAL-D3</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">30049</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">10</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">0</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">2100</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">21000</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">2520</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">23520</td>
                                            </tr>
                                            <tr style="text-align:center;">
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">2</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px; text-align:left;">EMYRIC B12</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">30049</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">5</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px; color:#10b981;">1</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">455</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">2275</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">273</td>
                                                <td style="border:1px solid #1e293b; padding:1px 2px;">2548</td>
                                            </tr>
                                        </table>
                                        <div style="display:flex; justify-content:space-between; margin-top:3px; padding-top:2px; border-top:1px solid #334155;">
                                            <span>Taxable: ₹23,275</span><span>CGST+SGST: ₹2,793</span><span style="color:#f59e0b; font-weight:800;">Grand: ₹26,068</span>
                                        </div>
                                        <div style="text-align:center; font-size:0.42rem; margin-top:3px; color:#475569; border-top:1px dashed #1e293b; padding-top:2px;">E.&O.E. | VADODARA Jurisdiction | Computer Generated</div>
                                    </div>
                                </div>

                            </div>
                            <input type="hidden" id="set-inv-style" value="classic">
                            <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 1.5rem; text-align: center;">💾 Save Settings to apply the selected template to all future invoice PDFs.</p>
                        </div>`;

const newContent = content.slice(0, si) + REPLACEMENT + content.slice(ei);
fs.writeFileSync('admin.html', newContent, 'utf-8');
console.log('Done! admin.html patched successfully.');
