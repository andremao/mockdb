const mockjs = require('mockjs');
const fs = require('fs');
const path = require('path');
const URLPattern = require('url-pattern');
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const projRootPath = process.cwd();

const dir = path.resolve(projRootPath, 'mockdb');
if (!fs.existsSync(dir)) {
  throw new Error(`Cannot find dir "${dir}"`);
}

const mockDir = path.resolve(projRootPath, 'mockdb/mock');
if (!fs.existsSync(mockDir)) {
  throw new Error(`Cannot find dir "${mockDir}"`);
}

const jsonDir = path.resolve(projRootPath, 'mockdb/json');
if (!fs.existsSync(jsonDir)) {
  fs.mkdirSync(jsonDir);
}

module.exports = {
  middleware: (req, res, next) => {
    const { path: reqPath, method } = req;

    const files = fs.readdirSync(mockDir);

    if (!files.length) {
      return next();
    }

    const requests = [];

    files.forEach((v) => {
      const p = path.resolve(mockDir, v);
      delete require.cache[require.resolve(p)];
      requests.push(...require(p).requests);
    });

    const existed = requests.some(({ type = 'GET', url, tpl, handle }) => {
      if (type.toUpperCase() !== method.toUpperCase()) return false;

      if (url instanceof RegExp) {
        if (!url.test(reqPath)) return false;
      } else {
        const params = new URLPattern(url).match(reqPath);
        if (!params) {
          return false;
        }

        if (req.params) {
          Object.assign(req.params, params);
        } else {
          req.params = params;
        }
      }

      if (handle) {
        handle(req, res, next);
      } else {
        res.json(mockjs.mock(tpl));
      }

      return true;
    });

    if (!existed) next();
  },
  service(module) {
    const db = lowdb(new FileSync(path.resolve(jsonDir, `${module}.json`)));
    db.defaults({ list: [] }).write();
    const _ = db._;

    return {
      // 插入数据
      insert(data) {
        const model = _.assign(data, {
          id: mockjs.Random.guid(),
        });
        db.get('list').push(model).write();
        return model;
      },
      // 分页查询
      pagedQuery({ page, size }) {
        const list = db.get('list').value();
        if (!list || !list.length) {
          return {
            data: [],
            total: 0,
          };
        }
        return {
          data: _.chunk(list, size)[page - 1],
          total: list.length,
        };
      },
      // 根据id查找
      find(id) {
        return db.get('list').find({ id }).value();
      },
      // 根据id删除，删除成功返回被删除的数据，否则返回null
      delete(id) {
        const model = this.find(id);
        if (model) {
          db.get('list').remove({ id }).write();
        }
        return model;
      },
      // 补丁更新
      patchUpdate(id, data) {
        db.get('list').find({ id }).assign(data).write();
        return this.find(id);
      },
    };
  },
};
