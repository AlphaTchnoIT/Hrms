import mongoose from 'mongoose';

// One payroll run per month. "processed" runs can be re-run, "paid" runs are locked.
const payrollRunSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    status: { type: String, enum: ['processed', 'paid'], default: 'processed' },
    employeeCount: { type: Number, default: 0 },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    totalEmployerCost: { type: Number, default: 0 }, // employer NI + employer pension
    // Things HR should check: below minimum wage, eligible for pension but not enrolled
    warnings: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, name: String, message: String, _id: false }],
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
    paidAt: Date,
  },
  { timestamps: true }
);

payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

const lineItemSchema = new mongoose.Schema({ name: String, amount: Number }, { _id: false });

const payslipSchema = new mongoose.Schema(
  {
    payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },

    // Snapshot of employee details at the time of payroll
    employeeSnapshot: {
      name: String,
      employeeCode: String,
      department: String,
      designation: String,
      dateOfJoining: Date,
      niNumber: String,
      taxCode: String,
      niCategory: String,
      bankName: String,
      sortCode: String,
      accountNumber: String,
    },

    totalDays: Number,
    paidDays: Number,
    lopDays: Number,
    earnings: [lineItemSchema],
    deductions: [lineItemSchema],
    grossEarnings: Number,
    totalDeductions: Number,
    netPay: Number,
    // Paid by the company on top of gross pay (not deducted): employer NI, employer pension
    employerContributions: [lineItemSchema],
    taxablePay: Number,
    status: { type: String, enum: ['processed', 'paid'], default: 'processed' },
  },
  { timestamps: true }
);

payslipSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

export const PayrollRun = mongoose.model('PayrollRun', payrollRunSchema);
export const Payslip = mongoose.model('Payslip', payslipSchema);
