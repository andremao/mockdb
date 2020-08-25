const mockjs = require('mockjs');
const fs = require('fs');
const _ = require('lodash');
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

const dbDir = path.resolve(projRootPath, 'mockdb/db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

module.exports = {
  middleware() {
    return (req, res, next) => {
      const { path: reqPath, method: reqMethod } = req;

      const files = fs.readdirSync(mockDir).filter((v) => v.endsWith('.js'));

      if (!files.length) {
        return next();
      }

      const requests = [];

      files.forEach((v) => {
        const p = path.resolve(mockDir, v);
        delete require.cache[require.resolve(p)];
        requests.push(...require(p).requests);
      });

      const existed = requests.some(({ method = 'GET', url, handler }) => {
        if (method.toUpperCase() !== reqMethod.toUpperCase()) return false;

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

        handler(req, res, next);

        return true;
      });

      if (!existed) next();
    };
  },
  service(jsonFileName) {
    if (!jsonFileName.endsWith('.json')) {
      jsonFileName += '.json';
    }
    const db = lowdb(new FileSync(path.resolve(dbDir, jsonFileName)));
    db.defaults({ list: [] }).write();

    return {
      getDB() {
        return db;
      },
      getState() {
        return db.getState();
      },
      setState(state) {
        db.setState(state);
        return this;
      },
      // 插入数据
      insert(data) {
        if (_.isArray(data)) {
          data.map((v) => {
            v.id = mockjs.Random.guid();
            return v;
          });
          db.get('list')
            .push(...data)
            .write();
        } else {
          data.id = mockjs.Random.guid();
          db.get('list').push(data).write();
        }
        return data;
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
      // 根据id查找
      find(id) {
        return db.get('list').find({ id }).value();
      },
      // 分页查询
      pagingQuery({ page = 1, size = 10, filter, sort }) {
        let chain = db.get('list');

        if (filter) {
          chain = chain.filter(filter);
        }

        if (sort) {
          chain = chain.sort(sort);
        }

        const list = chain.value() || [];

        return {
          data: _.chunk(list, size)[page - 1] || [],
          total: list.length,
        };
      },
    };
  },
};
