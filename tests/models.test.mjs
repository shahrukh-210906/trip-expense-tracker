import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { createModels } from '../server/models.mjs';
import { assertCanRecord, canReadPersonalExpense, canReadPurseEntry, isLead } from '../server/access.mjs';

const { Trip, PersonalExpense, PurseEntry } = createModels();
const lead = new mongoose.Types.ObjectId(), member = new mongoose.Types.ObjectId(), outsider = new mongoose.Types.ObjectId();
const trip = new Trip({ name: 'Goa', joinCode: 'A9B2X7', createdBy: lead, participants: [lead, member], groupLeads: [lead] });
const event = () => ({ tripId: trip._id, recordedBy: member, clientId: randomUUID(), clientCreatedAt: '2026-09-15T10:00:00Z', amountPaise: 60000, title: 'Lunch' });

test('trip requires at least one lead and all leads belong to the trip', async () => {
  await trip.validate();
  await assert.rejects(new Trip({ ...trip.toObject(), groupLeads: [] }).validate());
  await assert.rejects(new Trip({ ...trip.toObject(), groupLeads: [outsider] }).validate());
});
test('trip rejects duplicate members and malformed invite codes', async () => {
  await assert.rejects(new Trip({ ...trip.toObject(), participants: [lead, lead] }).validate());
  await assert.rejects(new Trip({ ...trip.toObject(), joinCode: 'BAD!' }).validate());
});
test('payer can pay entirely for a friend without including themselves', async () => {
  const e = new PersonalExpense({ ...event(), splitAmong: [lead] });
  await e.validate();
  assert.doesNotThrow(() => assertCanRecord(trip, member, e, 'personal'));
});
test('amounts must be positive integer paise within the limit', async () => {
  for (const amountPaise of [0, -1, 0.5, Infinity, 1_000_000_001]) {
    await assert.rejects(new PersonalExpense({ ...event(), amountPaise, splitAmong: [member] }).validate());
  }
});
test('empty and duplicate beneficiaries are rejected', async () => {
  for (const splitAmong of [[], [member, member]]) {
    await assert.rejects(new PersonalExpense({ ...event(), splitAmong }).validate());
  }
});
test('sync records require a valid client ID and client timestamp', async () => {
  for (const fields of [{ clientId: 'bad' }, { clientCreatedAt: 'invalid' }, { clientCreatedAt: undefined }]) {
    await assert.rejects(new PersonalExpense({ ...event(), ...fields, splitAmong: [lead] }).validate());
  }
});
test('cannot impersonate another payer or add an outside beneficiary', () => {
  assert.throws(() => assertCanRecord(trip, lead, { ...event(), splitAmong: [lead] }, 'personal'));
  assert.throws(() => assertCanRecord(trip, member, { ...event(), splitAmong: [outsider] }, 'personal'));
  assert.throws(() => assertCanRecord(trip, outsider, { ...event(), recordedBy: outsider, splitAmong: [member] }, 'personal'));
});
test('members may contribute; only leads may spend or set opening balances', async () => {
  const contribution = new PurseEntry({ ...event(), kind: 'contribution' });
  await contribution.validate();
  assert.doesNotThrow(() => assertCanRecord(trip, member, contribution, 'purse'));
  for (const kind of ['expense', 'opening']) {
    assert.throws(() => assertCanRecord(trip, member, { ...event(), kind }, 'purse'));
    assert.doesNotThrow(() => assertCanRecord(trip, lead, { ...event(), recordedBy: lead, kind, splitAmong: [member] }, 'purse'));
  }
});
test('all members can read purse contributions and spending, but outsiders cannot', () => {
  const e = { ...event(), kind: 'contribution' };
  assert.equal(canReadPurseEntry(trip, member, e), true);
  assert.equal(canReadPurseEntry(trip, lead, e), true);
  assert.equal(canReadPurseEntry(trip, member, { ...e, recordedBy: lead }), true);
  assert.equal(canReadPurseEntry(trip, member, { ...e, kind: 'expense' }), true);
  assert.equal(canReadPurseEntry(trip, outsider, e), false);
});
test('self-only expenses are private even from a group lead', () => {
  const e = { ...event(), splitAmong: [member] };
  assert.equal(canReadPersonalExpense(trip, member, e), true);
  assert.equal(canReadPersonalExpense(trip, lead, e), false);
  assert.equal(canReadPersonalExpense(trip, lead, { ...e, splitAmong: [member, lead] }), true);
});
test('cross-trip records cannot be read or written', () => {
  const e = { ...event(), tripId: new mongoose.Types.ObjectId(), kind: 'contribution', splitAmong: [lead] };
  assert.equal(canReadPersonalExpense(trip, lead, e), false);
  assert.equal(canReadPurseEntry(trip, lead, e), false);
  assert.throws(() => assertCanRecord(trip, member, e, 'personal'));
});
test('a lead label alone does not grant access without membership', () => {
  assert.equal(isLead({ ...trip.toObject(), groupLeads: [outsider] }, outsider), false);
});
