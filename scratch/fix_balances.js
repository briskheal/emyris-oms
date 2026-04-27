const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/emyris-oms";

// Define Schemas (Simplified for the script)
const stockistSchema = new mongoose.Schema({
    outstandingBalance: { type: Number, default: 0 }
});
const Stockist = mongoose.model('Stockist', stockistSchema);

const invoiceSchema = new mongoose.Schema({
    stockist: mongoose.Schema.Types.ObjectId,
    grandTotal: Number
});
const Invoice = mongoose.model('Invoice', invoiceSchema);

const purchaseEntrySchema = new mongoose.Schema({
    supplier: mongoose.Schema.Types.ObjectId,
    grandTotal: Number
});
const PurchaseEntry = mongoose.model('PurchaseEntry', purchaseEntrySchema);

const financialNoteSchema = new mongoose.Schema({
    party: mongoose.Schema.Types.ObjectId,
    noteType: String,
    amount: Number,
    status: String
});
const FinancialNote = mongoose.model('FinancialNote', financialNoteSchema);

const paymentSchema = new mongoose.Schema({
    party: mongoose.Schema.Types.ObjectId,
    type: String,
    amount: Number
});
const Payment = mongoose.model('Payment', paymentSchema);

async function fixBalances() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to database");

        const parties = await Stockist.find();
        console.log(`Processing ${parties.length} parties...`);

        for (const party of parties) {
            let balance = 0;

            // 1. Invoices (Debit)
            const invoices = await Invoice.find({ stockist: party._id });
            invoices.forEach(i => balance += i.grandTotal);

            // 2. Purchases (Credit)
            const purchases = await PurchaseEntry.find({ supplier: party._id });
            purchases.forEach(p => balance -= p.grandTotal);

            // 3. Notes (CN = Credit, DN = Debit)
            const notes = await FinancialNote.find({ party: party._id });
            notes.forEach(n => {
                if (n.status === 'rejected') return;
                if (n.noteType === 'CN') balance -= n.amount;
                else balance += n.amount;
            });

            // 4. Payments (Receipt = Credit, Payment = Debit)
            const payments = await Payment.find({ party: party._id });
            payments.forEach(p => {
                if (p.type === 'RECEIPT') balance -= p.amount;
                else balance += p.amount;
            });

            const roundedBalance = Math.round(balance);
            if (party.outstandingBalance !== roundedBalance) {
                console.log(`Fixing ${party._id} (Current: ${party.outstandingBalance}, New: ${roundedBalance})`);
                party.outstandingBalance = roundedBalance;
                await party.save();
            }
        }

        console.log("Sync complete");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixBalances();
