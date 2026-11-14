// Moi truong gia lap cho cac bai kiem thu: khong can MongoDB, khong gui email that.
// Cach lam: chan require("mongoose") / require("nodemailer") va thay cac model bang ban gia luu trong bo nho.
const Module = require("module");
const path = require("path");

const SRC = path.resolve(__dirname, "../../src");
process.env.EMAIL_RETRY_DELAY_MS = "1"; // khong cho lau giua cac lan thu gui email

// ---------- Gia lap thu vien ----------
const nodemailerState = { calls: [], failTimes: 0 };
const nodemailerStub = {
  createTransport: () => ({
    sendMail: async (options) => {
      nodemailerState.calls.push(options);
      if (nodemailerState.failTimes > 0) {
        nodemailerState.failTimes -= 1;
        throw new Error("SMTP loi gia lap");
      }
    },
  }),
};
const mongooseStub = {
  isValidObjectId: (v) => /^[0-9a-fA-F]{24}$/.test(String(v)),
  Schema: class Schema {},
  model: () => ({}),
  Types: { ObjectId: class ObjectId {} },
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "mongoose") return mongooseStub;
  if (request === "nodemailer") return nodemailerStub;
  return originalLoad.call(this, request, ...rest);
};

function src(...parts) {
  return require(path.join(SRC, ...parts));
}

function setModel(name, impl) {
  const file = require.resolve(path.join(SRC, "models", `${name}.js`));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: impl, children: [], paths: [] };
}

// ---------- Du lieu gia ----------
let counter = 0;
const newId = () => (++counter).toString(16).padStart(24, "0");

// Mang con (assignees, sharedWith) tu gan _id cho phan tu moi, giong mongoose
class SubArray extends Array {
  push(...items) {
    return super.push(...items.map((item) => ({ _id: newId(), ...item })));
  }
}

// Doi tuong tra ve co the "await" va noi chuoi .select/.sort/.limit/.populate giong query cua mongoose
function chain(getValue, options = {}) {
  const q = {
    select: () => q,
    sort: () => q,
    limit: () => q,
    populate: () => q,
    then: (resolve, reject) => Promise.resolve().then(getValue).then(resolve, reject),
  };
  return Object.assign(q, options);
}

function createDb() {
  const db = { users: [], tasks: [], notifications: [], activities: [], emailLogs: [] };

  db.addUser = (fullName, email) => {
    const user = { _id: newId(), fullName, email: email || `${fullName.toLowerCase().replace(/\s+/g, "")}@x.com`, avatarUrl: "" };
    db.users.push(user);
    return user;
  };

  db.addTask = (ownerId, extra = {}) => {
    const task = {
      _id: newId(),
      title: "Cong viec mau",
      description: "",
      status: "todo",
      priority: "medium",
      startDate: null,
      dueDate: null,
      createdBy: ownerId,
      reminderSent: false,
      ...extra,
      assignees: new SubArray(),
      sharedWith: new SubArray(),
    };
    (extra.assignees || []).forEach((a) => task.assignees.push(a));
    (extra.sharedWith || []).forEach((s) => task.sharedWith.push(s));
    task.save = async () => {};
    task.deleteOne = async () => {
      db.tasks = db.tasks.filter((t) => t !== task);
    };
    task.toObject = () => ({ ...task, assignees: [...task.assignees], sharedWith: [...task.sharedWith] });
    db.tasks.push(task);
    return task;
  };

  const findLog = (id) => db.emailLogs.find((l) => String(l._id) === String(id)) || null;

  const matchUser = (cond, u) => {
    if (cond.$or) return cond.$or.some((c) => matchUser(c, u));
    return Object.entries(cond).every(([key, rule]) => {
      if (rule && rule.$in) return rule.$in.map(String).includes(String(u[key]));
      if (rule instanceof RegExp) return rule.test(u[key]);
      return u[key] === rule;
    });
  };

  setModel("User", {
    find: (cond) => chain(() => db.users.filter((u) => matchUser(cond, u))),
    findById: (id) => chain(() => db.users.find((u) => String(u._id) === String(id)) || null),
  });
  setModel("Task", {
    findById: (id) => chain(() => db.tasks.find((t) => String(t._id) === String(id)) || null),
  });
  setModel("Notification", {
    insertMany: async (docs) => void db.notifications.push(...docs),
    deleteMany: async ({ taskId }) => {
      db.notifications = db.notifications.filter((n) => String(n.taskId) !== String(taskId));
    },
  });
  setModel("TaskActivity", {
    create: async (doc) => void db.activities.push(doc),
    deleteMany: async ({ taskId }) => {
      db.activities = db.activities.filter((a) => String(a.taskId) !== String(taskId));
    },
  });
  setModel("EmailLog", {
    create: async (doc) => {
      const log = { _id: newId(), attempts: 0, errorMessage: "", sentAt: null, ...doc };
      log.save = async () => {};
      log.toObject = () => {
        const { save, toObject, ...rest } = log;
        return rest;
      };
      db.emailLogs.push(log);
      return log;
    },
    findById: (id) => chain(() => findLog(id)),
    findOneAndUpdate: (cond, update) =>
      chain(() => {
        const log = findLog(cond._id);
        if (!log || log.status !== cond.status || log.attempts >= cond.attempts.$lt) return null;
        Object.assign(log, update.$set);
        return log;
      }),
  });
  return db;
}

// ---------- Chay chuoi middleware + handler nhu Express ----------
function makeRes() {
  let finish;
  const res = {
    statusCode: 200,
    body: undefined,
    finished: new Promise((resolve) => (finish = resolve)),
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      finish();
      return this;
    },
  };
  return res;
}

async function run(handlers, req) {
  const { errorHandler } = src("middleware", "errorMiddleware.js");
  const res = makeRes();
  req.params = req.params || {};
  req.query = req.query || {};
  req.body = req.body || {};
  let i = 0;
  const next = async (err) => {
    if (err) return errorHandler(err, req, res, () => {});
    const handler = handlers[i++];
    if (!handler) return;
    try {
      await handler(req, res, next);
    } catch (e) {
      errorHandler(e, req, res, () => {});
    }
  };
  next();
  await Promise.race([res.finished, new Promise((r) => setTimeout(r, 1000))]);
  await new Promise((r) => setTimeout(r, 30)); // doi cac tac vu chay ngam (gui email, ghi log)
  return res;
}

module.exports = { src, createDb, run, nodemailerState, newId };
