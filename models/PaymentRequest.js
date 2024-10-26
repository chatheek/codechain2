const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
    email: { type: String, required: true },
    course: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    subMethod: { type: String, required: true },
    paidAmount: { type: String, default: "no data"}, // Amount paid
    amountDue: { type: String,default: "no data" }, // Amount due
    paidamountsofar:{type:String },
    paymentduesofar:{type:String}
});

const PaymentRequest = mongoose.model('PaymentRequest', paymentRequestSchema);

module.exports = PaymentRequest;
