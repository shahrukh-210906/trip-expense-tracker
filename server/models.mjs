import mongoose from 'mongoose';

const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw', optimisticConcurrency: true };
const objectId = () => ({ type: Schema.Types.ObjectId, required: true, ref: 'User' });
const money = (minimum = 1) => ({
  type: Number, required: true, min: minimum, max: 1_000_000_000,
  validate: { validator: Number.isSafeInteger, message: 'Money must be integer paise.' },
});
const uniqueIds = values => Array.isArray(values) && values.length > 0 &&
  values.length <= 100 && values.every(Boolean) && new Set(values.map(String)).size === values.length;
const idList = () => ({ type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true,
  validate: { validator: uniqueIds, message: 'Provide 1–100 distinct users.' } });
const eventFields = () => ({
  tripId: { type: Schema.Types.ObjectId, required: true, ref: 'Trip', immutable: true },
  recordedBy: { ...objectId(), immutable: true },
  clientId: { type: String, required: true, immutable: true,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
  clientCreatedAt: { type: Date, required: true, immutable: true },
});

export const userSchema = new Schema({
  displayName: { type: String, trim: true, required: true, maxlength: 60 },
  tokenHash: { type: String, select: false },
  tokenCreatedAt: { type: Date },
  tokenRevokedAt: { type: Date },
  recoveryCodeHash: { type: String, select: false },
}, options);
userSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });

export const tripSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  currency: { type: String, enum: ['INR'], default: 'INR', immutable: true },
  joinCode: { type: String, required: true, uppercase: true, match: /^[A-Z0-9]{6}$/ },
  createdBy: { ...objectId(), immutable: true },
  participants: idList(),
  groupLeads: { ...idList(), validate: [
    { validator: uniqueIds, message: 'Provide 1–100 distinct leads.' },
    { validator: function (values) {
      return values.every(id => this.participants.some(p => String(p) === String(id)));
    }, message: 'Every group lead must be a trip participant.' },
  ] },
  purseBalancePaise: { ...money(0), default: 0, max: Number.MAX_SAFE_INTEGER },
}, options);
tripSchema.index({ joinCode: 1 }, { unique: true });
tripSchema.index({ participants: 1 });

export const personalExpenseSchema = new Schema({
  ...eventFields(),
  title: { type: String, trim: true, required: true, maxlength: 100 },
  amountPaise: money(),
  // recordedBy is the payer. Clients cannot specify a second payer identity.
  splitAmong: idList(),
}, options);

export const purseEntrySchema = new Schema({
  ...eventFields(),
  kind: { type: String, required: true, enum: ['opening', 'contribution', 'expense'], immutable: true },
  title: { type: String, trim: true, required: true, maxlength: 100 },
  amountPaise: money(),
}, options);

// Unique indexes enforce retry protection in MongoDB, not document validation.
for (const schema of [personalExpenseSchema, purseEntrySchema]) {
  schema.index({ tripId: 1, recordedBy: 1, clientId: 1 }, { unique: true });
  schema.index({ tripId: 1, clientCreatedAt: -1, _id: -1 });
  schema.index({ tripId: 1, recordedBy: 1, clientCreatedAt: -1 });
}
purseEntrySchema.index({ tripId: 1, kind: 1 }, {
  unique: true, partialFilterExpression: { kind: 'opening' },
});

export function createModels(connection = mongoose) {
  return {
    User: connection.models.User || connection.model('User', userSchema),
    Trip: connection.models.Trip || connection.model('Trip', tripSchema),
    PersonalExpense: connection.models.PersonalExpense || connection.model('PersonalExpense', personalExpenseSchema),
    PurseEntry: connection.models.PurseEntry || connection.model('PurseEntry', purseEntrySchema),
  };
}
