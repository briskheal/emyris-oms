
/**
 * Unified Report Data Engine
 * Consolidates logic from both generateReport implementations
 */
function getReportDataByType(type, data, fromDate, toDate) {
    const { invoices, purchases, payments, notes, expenses, products, stockists } = data;
    
    // Date filter helper
    const fromD = fromDate ? new Date(fromDate) : new Date(0);
    const toD = toDate ? new Date(toDate) : new Date();
    toD.setHours(23, 59, 59, 999);
    
    const filterByDate = (list, dateField = 'createdAt') => {
        return list.filter(x => {
            const d = new Date(x[dateField] || x.date || x.createdAt);
            return d >= fromD && d <= toD;
        });
    };

    const filteredInvoices = filterByDate(invoices);
    const filteredPurchases = filterByDate(purchases);
    const filteredPayments = filterByDate(payments, 'date');
    const filteredExpenses = filterByDate(expenses, 'date');
    const filteredNotes = filterByDate(notes, 'date');

    let reportData = [];
    let fileName = `Emyris_${type}_${new Date().toISOString().split('T')[0]}`;

    switch (type) {
        case 'sales-summary':
            fileName = "Sales_Summary_Report";
            reportData = filteredInvoices.map(inv => ({
                "Invoice No": inv.invoiceNo,
                "Date": new Date(inv.createdAt).toLocaleDateString('en-GB'),
                "Party Name": inv.stockistName,
                "Items": inv.items.length,
                "Taxable Value": inv.subTotal,
                "GST Amount": inv.gstAmount,
                "Grand Total": inv.grandTotal
            }));
            break;

        case 'party-sales':
        case 'party-profit-loss':
        case 'sale-purchase-party':
            fileName = "Party_Wise_Analytics";
            stockists.forEach(s => {
                const partyInvs = filteredInvoices.filter(inv => (inv.stockistId || inv.stockist?._id || '').toString() === s._id.toString());
                if (partyInvs.length === 0 && type === 'party-sales') return;
                const revenue = partyInvs.reduce((sum, inv) => sum + inv.subTotal, 0);
                const grandTotal = partyInvs.reduce((sum, inv) => sum + inv.grandTotal, 0);
                reportData.push({
                    "Party Name": s.companyName || s.name,
                    "Total Orders": partyInvs.length,
                    "Taxable Revenue": revenue.toFixed(2),
                    "Total Billing": grandTotal.toFixed(2),
                    "Current Outstanding": (s.outstandingBalance || 0).toFixed(2)
                });
            });
            break;

        case 'product-sales':
            fileName = "Product_Movement_Report";
            const prodMap = {};
            filteredInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    if(!prodMap[item.name]) prodMap[item.name] = { Name: item.name, QtySold: 0, Revenue: 0 };
                    prodMap[item.name].QtySold += item.qty;
                    prodMap[item.name].Revenue += item.totalValue;
                });
            });
            reportData = Object.values(prodMap).sort((a,b) => b.QtySold - a.QtySold);
            break;

        case 'purchase-register':
        case 'gstr-2':
            fileName = type === 'gstr-2' ? "GSTR_2_Purchases_Inward" : "Purchase_Register";
            reportData = filteredPurchases.map(p => ({
                "Pur No": p.purchaseNo,
                "Supplier": p.supplierName,
                "Inv No": p.supplierInvoiceNo || p.invoiceNo,
                "Date": new Date(p.invoiceDate || p.date || p.createdAt).toLocaleDateString('en-GB'),
                "Taxable": p.subTotal || 0,
                "GST": p.gstAmount || 0,
                "Total Value": p.grandTotal || 0
            }));
            break;

        case 'outstanding-summary':
        case 'consolidated-ledger':
        case 'party-statement':
        case 'ageing-report':
            fileName = "Party_Outstanding_Summary";
            reportData = stockists
                .filter(s => s.outstandingBalance !== 0 || type !== 'outstanding-summary')
                .map(s => ({
                    "Party Name": s.name,
                    "City": s.city || '-',
                    "Type": s.partyType || 'STOCKIST',
                    "Credit Limit": s.creditLimit || 0,
                    "Outstanding Balance": (s.outstandingBalance || 0).toFixed(2),
                    "Status": (s.outstandingBalance || 0) > (s.creditLimit || 0) ? "LIMIT EXCEEDED" : "OK"
                }));
            break;

        case 'bill-profit':
            fileName = "Bill_Profitability_Report";
            filteredInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    const prod = products.find(p => p._id.toString() === (item.product || item.productId || '').toString());
                    const costPrice = prod ? prod.pts : 0;
                    const profit = (item.priceUsed - costPrice) * item.qty;
                    reportData.push({
                        "Invoice No": inv.invoiceNo,
                        "Date": new Date(inv.createdAt).toLocaleDateString('en-GB'),
                        "Party": inv.stockistName,
                        "Product": item.name,
                        "Qty": item.qty,
                        "Sale Rate": item.priceUsed,
                        "Cost Rate": costPrice,
                        "Profit Amount": profit.toFixed(2),
                        "Margin %": costPrice > 0 ? (((item.priceUsed - costPrice) / costPrice) * 100).toFixed(2) : '100'
                    });
                });
            });
            break;

        case 'p-and-l':
            fileName = "Profit_and_Loss_Statement";
            const totalSales = filteredInvoices.reduce((s, x) => s + x.subTotal, 0);
            const totalExpenses = filteredExpenses.reduce((s, x) => s + x.amount, 0);
            let totalCogs = 0;
            filteredInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    const prod = products.find(p => p._id.toString() === (item.product || item.productId || '').toString());
                    totalCogs += (prod ? prod.pts : 0) * item.qty;
                });
            });
            reportData = [
                { "Metric": "Total Sales (Revenue)", "Amount": totalSales.toFixed(2) },
                { "Metric": "Cost of Goods Sold (COGS)", "Amount": totalCogs.toFixed(2) },
                { "Metric": "Gross Profit", "Amount": (totalSales - totalCogs).toFixed(2) },
                { "Metric": "Total Indirect Expenses", "Amount": totalExpenses.toFixed(2) },
                { "Metric": "NET PROFIT / LOSS", "Amount": (totalSales - totalCogs - totalExpenses).toFixed(2) }
            ];
            break;

        case 'stock-summary':
        case 'inventory-val':
            fileName = "Inventory_Valuation_Report";
            reportData = products.map(p => ({
                "Product Name": p.name,
                "Packing": p.packing,
                "HSN": p.hsn,
                "Current Stock": p.qtyAvailable || p.stock || 0,
                "PTS Rate": p.pts,
                "Valuation (PTS)": ((p.qtyAvailable || p.stock || 0) * p.pts).toFixed(2),
                "Valuation (MRP)": ((p.qtyAvailable || p.stock || 0) * p.mrp).toFixed(2)
            }));
            break;

        case 'low-stock':
            fileName = "Shortage_Reorder_List";
            reportData = products
                .filter(p => (p.qtyAvailable || p.stock || 0) <= 20)
                .map(p => ({
                    "Product Name": p.name,
                    "Packing": p.packing,
                    "Current Stock": p.qtyAvailable || p.stock || 0,
                    "Status": (p.qtyAvailable || p.stock || 0) === 0 ? "OUT OF STOCK" : "LOW STOCK"
                }));
            break;

        case 'gstr-1':
        case 'gstr1':
            fileName = "GSTR_1_Sales_Outward";
            reportData = filteredInvoices.map(inv => {
                const party = stockists.find(s => s._id.toString() === (inv.stockistId || inv.stockist?._id || '').toString());
                return {
                    "GSTIN": party ? (party.gstin || party.gstNo || "URD") : "URD",
                    "Receiver Name": inv.stockistName,
                    "Invoice No": inv.invoiceNo,
                    "Date": new Date(inv.createdAt).toLocaleDateString('en-GB'),
                    "Total Value": inv.grandTotal,
                    "Taxable Value": inv.subTotal,
                    "IGST": party && party.state !== "GUJARAT" ? inv.gstAmount : 0,
                    "CGST": party && party.state === "GUJARAT" ? inv.gstAmount / 2 : 0,
                    "SGST": party && party.state === "GUJARAT" ? inv.gstAmount / 2 : 0
                };
            });
            break;

        case 'exp-txn':
        case 'expense-transaction':
        case 'expense-category':
            fileName = "Expense_Management_Log";
            reportData = filteredExpenses.map(e => ({
                "Exp No": e.expenseNo,
                "Date": new Date(e.date).toLocaleDateString('en-GB'),
                "Category": e.categoryName,
                "Title": e.title,
                "Method": e.paymentMethod,
                "Amount": e.amount
            }));
            break;

        case 'bank-statement':
        case 'business-status':
            fileName = "Bank_Statement_UPI_Status";
            const bankTxns = filteredPayments.filter(p => p.method === 'Bank Transfer' || p.method === 'UPI');
            reportData = bankTxns.map(p => ({
                "Date": new Date(p.date).toLocaleDateString('en-GB'),
                "Ref No": p.refNo,
                "Party": p.partyName,
                "Type": p.type,
                "Amount": p.amount
            }));
            break;

        case 'cashflow':
        case 'balance-sheet':
            fileName = "Financial_Cashflow_Statement";
            const totalIn = filteredPayments.filter(p => p.type === 'RECEIPT').reduce((s, x) => s + x.amount, 0);
            const totalOut = filteredPayments.filter(p => p.type === 'PAYMENT').reduce((s, x) => s + x.amount, 0);
            const totalExpE = filteredExpenses.reduce((s, x) => s + x.amount, 0);
            reportData = [
                { "Metric": "Total Inflow (Receipts)", "Amount": totalIn.toFixed(2) },
                { "Metric": "Total Outflow (Payments)", "Amount": totalOut.toFixed(2) },
                { "Metric": "Total Expenses (Overhead)", "Amount": totalExpE.toFixed(2) },
                { "Metric": "Net Cash Position", "Amount": (totalIn - totalOut - totalExpE).toFixed(2) }
            ];
            break;

        case 'discount-report':
        case 'item-discount':
            fileName = "Discount_Analysis_Report";
            filteredInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    if(item.bonusQty > 0 || (item.mrp - item.priceUsed) > 0) {
                        reportData.push({
                            "Invoice": inv.invoiceNo,
                            "Party": inv.stockistName,
                            "Item": item.name,
                            "Billed Qty": item.qty,
                            "Bonus Qty": item.bonusQty || 0,
                            "MRP": item.mrp || 0,
                            "Billed Rate": item.priceUsed,
                            "Discount Value": (((item.mrp || 0) - item.priceUsed) * item.qty).toFixed(2)
                        });
                    }
                });
            });
            break;

        case 'doc-expiry':
            fileName = "Compliance_Expiry_Tracker";
            stockists.forEach(s => {
                reportData.push({
                    "Party": s.companyName || s.name,
                    "Drug License": s.dlNo || "N/A",
                    "FSSAI": s.fssaiNo || "N/A",
                    "GSTIN": s.gstNo || s.gstin || "URD",
                    "Verification Status": s.approved ? "ACTIVE" : "PENDING"
                });
            });
            break;

        case 'item-batch':
            fileName = "Batch_Wise_Inventory";
            products.forEach(p => {
                (p.batches || []).forEach(b => {
                    reportData.push({
                        "Product": p.name,
                        "Batch No": b.batchNo,
                        "Expiry": b.expDate,
                        "Qty Available": b.qtyAvailable,
                        "Valuation (PTS)": (b.qtyAvailable * p.pts).toFixed(2)
                    });
                });
            });
            break;

        case 'credit-debit-summary':
            fileName = "Financial_Adjustment_Notes";
            reportData = filteredNotes.map(n => ({
                "Note Type": n.noteType || n.type,
                "Note Ref": n.noteNo,
                "Date": new Date(n.date || n.createdAt).toLocaleDateString('en-GB'),
                "Party Name": n.partyName,
                "Reason": n.reason,
                "Impact Amount": n.amount
            }));
            break;

        default:
            fileName = `Emyris_${type}_Data_Dump`;
            reportData = filteredInvoices.map(i => ({ "Date": i.createdAt, "No": i.invoiceNo, "Party": i.stockistName, "Amount": i.grandTotal }));
    }

    return { reportData, fileName };
}
