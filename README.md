## 介绍

这是一个基于 lowdb 支持 **JSON 文件持久化** 和 **热加载配置文件** 管理 `mockjs` 的 Express 中间件模块

## 安装

`npm i -D @andremao/mockdb`

## 使用

1. 在项目的**根目录下**新建目录 `mockdb/mock`，在此目录下创建的所有 `*.js` 文件都将自动识别为 `mockdb` 配置文件

2. 当调用 service 方法获取 service 实例时，持久化的 `*.json` 文件会自动生成在 `mockdb/db/*.json` 下

3. `mockdb` 配置文件内容如下（假设存在 `mockdb/mock/user.js` 配置文件）：

   ```javascript
   const service = require('@andremao/mockdb').service('user');
   const mockjs = require('mockjs');

   module.exports = {
     // 要被 mockjs 拦截的请求集
     requests: [
       {
         // 请求类型支持大小写
         type: 'GET',
         // 注意：
         //   mockjs 只能拦截本地主机地址（如：http://localhost:8080/user/list）
         //   mockjs 不能拦截跨域的线上地址（如：http://api.itcast.cn/user/list）
         url: '/user/list',
         // 数据模板，请参照 mockjs
         // 注意：tpl 生成出的数据不会持久化到 json 文件，如需持久化请使用 handle 配合 service（请看下一个例子）
         tpl: {
           code: 200,
           message: '获取用户列表成功',
           'data|1-10': [{ id: '@ID()', name: '@CNAME()', 'age|18-60': 1 }],
         },
       },
       // 分页查询
       {
         type: 'get',
         url: '/user/pagedquery',
         handle(req, res) {
           console.log(req.query, 'req.query');

           // 如果 JSON 文件中没有数据，则自动生成 100 条
           const { list } = service.getState();
           if (!list || !list.length) {
             // 批量插入，持久化至 JSON 文件中，insert 方法支持单个对象或数组
             service.insert(
               mockjs.mock({
                 'list|100': [
                   { id: '@GUID()', name: '@CNAME()', 'age|15-60': 1 },
                 ],
               }).list,
             );
           }
           // /如果 JSON 文件中没有数据，则自动生成 100 条

           const { page, size, name, age, ageType } = req.query;
           const conditions = {};
           if (name) {
             conditions.like = { name };
           }
           if (age != null) {
             conditions[ageType] = { age: parseInt(age) };
           }
           // 分页查询，参数含义如下：
           // { page: 当前页码, size: 每页条数, like: 模糊查询, eq: 等于, lt: 小于, gt: 大于, le: 小于等于, ge: 大于等于 }
           const result = service.pagedQuery({ page, size, ...conditions });
           res.json({
             code: 200,
             message: '分页查询成功',
             ...result,
           });
         },
       },
       // 根据 id 查询
       {
         type: 'get',
         // 支持动态路由参数
         url: '/user/:id',
         handle(req, res) {
           const { id } = req.params;
           // 根据 id 查找用户
           const user = service.find(id);
           res.json({
             code: 200,
             message: '获取用户信息成功',
             data: user,
           });
         },
       },
       // 增
       {
         type: 'post',
         url: '/user/create',
         handle(req, res) {
           console.log(req.body, 'req.body');
           // 插入单个，返回插入之后的对象（包含 id）
           const user = service.insert(req.body);
           res.json({
             code: 200,
             message: '添加用户成功',
             data: user,
           });
         },
       },
       // 删
       {
         type: 'delete',
         url: '/user/:id',
         handle(req, res) {
           console.log(req.params, 'req.params');
           // 根据 id 删除，返回被删除的对象
           const user = service.delete(req.params.id);
           res.json({
             code: 200,
             message: 'ok',
             user,
           });
         },
       },
       // 改
       {
         type: 'patch',
         url: '/user/:id',
         handle(req, res) {
           console.log(req.params, 'req.params');
           console.log(req.body, 'req.body');
           // 根据 id 补丁更新，返回更新后的对象
           const user = service.patchUpdate(req.params.id, req.body);
           res.json({
             code: 200,
             message: 'ok',
             user,
           });
         },
       },
     ],
   };
   ```

   补充：

   1. `tpl` 请参照 [mockjs](http://mockjs.com/) 的 `template` 格式
   2. `handle` 的优先级高于 `tpl`，配置了 `handle` 就会忽略 `tpl`

4. 在 vue 中使用，修改 `vue.config.js` 配置文件：

   ```javascript
   const mockdb = require('@andremao/mockdb');
   const bodyParser = require('body-parser');

   module.exports = {
     devServer: {
       before(app) {
         // 判断是否为开发环境
         if (process.env.NODE_ENV.toUpperCase() === 'DEVELOPMENT') {
           app.use(bodyParser.json(), mockdb.middleware());
         }
       },
     },
   };
   ```

   Demo 仓库地址：https://github.com/andremao/vue-mockdb-demo

5. 重启项目即可，并支持热加载，后续改动 `mockdb/mock/*.js` 与 `mockdb/db/*.json` 文件无需重启

6. 配合 `axios` 的请求拦截器，可以实现 **mock 环境** 与 **线上环境** 混搭

   发请求：

   ```javascript
   axios.post('/login?ismock=1', { uname: 'andremao', pwd: 'qwe123' });
   ```

   axios：

   ```javascript
   // 创建 axios 请求实例
   const request = axios.create({
     baseURL: 'http://api.itcast.cn/',
   });

   // 请求拦截器
   request.interceptors.request.use((cfg) => {
     // 如果是 mock 则把请求 baseURL 改成 本地地址，不然 mockjs 拦截不到
     if (cfg.url.includes('ismock=1')) {
       cfg.baseURL = 'http://localhost:8080';
     }
     return cfg;
   });
   ```

## API

### mockdb

```javascript
const mockdb = require('@andremao/mockdb');
```

#### mockdb.middleware()

获取中间件处理函数

#### mockdb.service(jsonFileName)

返回能操作 JSON 文件的 service 实例，jsonFileName 为 JSON 文件名（**尽量和 mockdb 配置文件名保持一致** ）

### service

```javascript
const service = mockdb.service('user.json');
```

#### service.insert(data)

插入数据，data 支持单个对象或数组，返回插入成功后的数据（包含 id）

#### service.delete(id)

根据 id 删除，删除成功返回被删除的数据，否则返回 null

#### service.patchUpdate(id, data)

根据 id 补丁更新，返回更新后的对象

#### service.find(id)

根据 id 查找，返回找到的对象

#### service.pagedQuery({ page, size, filter, sort })

分页查询，返回对象，形如`{ data: [...], total: 100 }`

参数列表如下：

- page: 当前页码，默认 1
- size: 每页条数，默认 10
- filter: 过滤方法 filter 的回调函数，Function
- sort: 排序方法 sort 的回调函数，Function

返回值如下：

- data：查询到的数据列表，Array
- total：满足条件的总数据量，Number

#### service.getState()

获取 JSON 文件中的全部数据，返回对象，形如：`{ list: [ ... ], ... }`

#### service.setState(state)

设置 JSON 文件中的全部数据，返回 service 实例

#### service.getDB()

返回 db 实例，具体 API 详见：[lowdb](https://github.com/typicode/lowdb)
