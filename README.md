## MockDB

这是一个支持 **热加载配置文件**、**JSON 文件持久化**、**模块化** 来管理 `mock` 请求的 Express 中间件模块

## 安装

`npm i -D @andremao/mockdb`

## 使用

1. 在项目的**根目录下**新建目录 `mockdb/mock`，在此目录下创建的所有 `*.js` 文件都将自动识别为 `mockdb` 配置文件

2. 当调用 service 方法获取 service 实例时，持久化的 `*.json` 文件会自动生成在 `mockdb/db/*.json` 下

3. `mockdb` 配置文件内容如下（假设存在 `mockdb/mock/user.js` 配置文件）：

   ```javascript
   const service = require('@andremao/mockdb').service('user.json');
   const mockjs = require('mockjs');
   
   module.exports = {
     // 要被 mockjs 拦截的请求集
     requests: [
       // 增
       {
         // 请求类型支持大小写
         method: 'post',
         // 注意：
         //   mockjs 只能拦截本地主机地址（如：http://localhost:8080/user）
         //   mockjs 不能拦截跨域的线上地址（如：http://api.itcast.cn/user）
         url: '/user',
         handler(req, res) {
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
         method: 'delete',
         url: '/user/:id',
         handler(req, res) {
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
         method: 'patch',
         url: '/user/:id',
         handler(req, res) {
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
       // 根据 id 查询
       {
         method: 'get',
         // 支持动态路由参数
         url: '/user/:id',
         handler(req, res) {
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
       // 分页查询
       {
         method: 'GET',
         url: '/users',
         handler(req, res) {
           console.log(req.query, 'req.query');
   
           // // 如果json文件中没有数据，则自动生成100条
           // const { list } = service.getState();
           // if (!list || !list.length) {
           //   service.insert(
           //     mockjs.mock({
           //       'list|100': [{ name: '@CNAME()', 'age|15-60': 1, id: '@GUID()' }],
           //     }).list,
           //   );
           // }
           // // /如果json文件中没有数据，则自动生成100条
   
           const { page, size, name, ageType } = req.query;
           const age = parseInt(req.query.age);
           const result = service.pagingQuery({
             page,
             size,
             // 过滤，就是数组的 filter 方法的回调函数
             filter(user) {
               const results = [];
               if (name) {
                 results.push(user.name.includes(name));
               }
               if (!isNaN(age)) {
                 switch (ageType) {
                   case 'eq':
                     results.push(user.age === age);
                     break;
                   case 'ne':
                     results.push(user.age !== age);
                     break;
                   case 'gt':
                     results.push(user.age > age);
                     break;
                   case 'lt':
                     results.push(user.age < age);
                     break;
                   case 'ge':
                     results.push(user.age >= age);
                     break;
                   case 'le':
                     results.push(user.age <= age);
                     break;
                 }
               }
               return results.every(v => v);
             },
             // 排序，就是数组的 sort 方法的回调函数
             sort(user1, user2) {
               // 何时把 user1 放到 user2 后面? 当 user1.age > user2.age 时
               if (user1.age > user2.age) return 1;
               // 何时把 user1 放到 user2 前面? 当 user1.age > user2.age 时
               if (user1.age < user2.age) return -1;
               // 何时不用换位置? 当 user1.age === user2.age 时
               return 0;
   
               // 补充顺明:
               // 1 上面的代码等价：return user1.age - user2.age; 虽然代码量少，但不推荐，因为可读性差
               // 2 不要直接使用 return user1.age > user2.age; 因为在不同运行环境下执行结果可能不一致，有坑！！！
             },
           });
           res.json({
             code: 200,
             message: 'ok',
             ...result,
           });
         },
       },
     ],
   };
   ```
   
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
