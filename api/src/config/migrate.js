const mongoose = require("mongoose");
const Task = require("../models/Task");

// Chuyen du lieu cu cho khop cau truc moi. Chay moi lan khoi dong server va an toan khi chay lai.
async function migrate() {
  // 1) Trang thai cu "done" doi ten thanh "completed"
  const renamed = await Task.updateMany({ status: "done" }, { $set: { status: "completed" } });
  if (renamed.modifiedCount > 0) {
    console.log(`Migrate: doi ${renamed.modifiedCount} cong viec tu "done" sang "completed"`);
  }

  // 2) Muc chia se tao tu truoc chua co _id (shareId), sharedBy, createdAt -> bo sung va luu lai
  const legacy = await Task.collection
    .find({ sharedWith: { $elemMatch: { _id: { $exists: false } } } })
    .toArray();
  for (const doc of legacy) {
    const fixed = doc.sharedWith.map((s) => ({
      ...s,
      _id: s._id || new mongoose.Types.ObjectId(),
      sharedBy: s.sharedBy || doc.createdBy,
      createdAt: s.createdAt || doc.updatedAt || new Date(),
    }));
    await Task.collection.updateOne({ _id: doc._id }, { $set: { sharedWith: fixed } });
  }
  if (legacy.length > 0) {
    console.log(`Migrate: bo sung shareId cho ${legacy.length} cong viec`);
  }
}

module.exports = migrate;
