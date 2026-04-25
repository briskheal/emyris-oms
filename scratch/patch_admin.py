import re

with open(r'd:\MY WORK FLOW\EMYRIS-OMS\admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

OLD = '''                        <!-- SPECIMEN INVOICE STYLE -->
                         <div class="glass-card" style="padding: 2rem; border-top: 4px solid var(--primary); margin-top: 2rem;">
                            <h3 class="section-title">📄 Specimen Invoice Section</h3>
                             <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">Select the GST-approved layout style for your tax invoices.</p>
                             
                             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;">
                                 <div class="glass-card" style="padding: 1rem; cursor: pointer; border: 2px solid var(--primary);" onclick="setInvoiceStyle(\'classic\')">
                                     <h4 style="margin: 0; font-size: 0.9rem;">Classic Pharma</h4>
                                     <p style="font-size: 0.7rem; color: var(--text-muted);">Standard vertical layout with separate Mfg Name.</p>
                                 </div>
                                 <div class="glass-card" style="padding: 1rem; cursor: pointer; border: 1px solid var(--glass-border);" onclick="setInvoiceStyle(\'modern\')">
                                     <h4 style="margin: 0; font-size: 0.9rem;">Modern Glass</h4>
                                     <p style="font-size: 0.7rem; color: var(--text-muted);">Sleek, horizontal layout with bold headings.</p>
                                 </div>
                                 <div class="glass-card" style="padding: 1rem; cursor: pointer; border: 1px solid var(--glass-border);" onclick="setInvoiceStyle(\'compact\')">
                                     <h4 style="margin: 0; font-size: 0.9rem;">Compact Compliance</h4>
                                     <p style="font-size: 0.7rem; color: var(--text-muted);">Maximum data density for long invoices.</p>
                                 </div>
                             </div>
                             <input type="hidden" id="set-inv-style" value="classic">
                         </div>'''

# Find the block by searching for it without leading whitespace issues
start_marker = '<!-- SPECIMEN INVOICE STYLE -->'
end_marker = '<input type="hidden" id="set-inv-style" value="classic">\n                        </div>'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx == -1:
    print("START not found")
    exit(1)
if end_idx == -1:
    print("END not found")
    exit(1)

print(f"Found block: lines {start_idx} to {end_idx}")
print("Block content:")
print(repr(content[start_idx:end_idx]))
