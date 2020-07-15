### 介绍

这是一个支持 **文件持久化** 和 **热加载配置文件** 结合 `webpack devServer` 来管理 `mockjs` 的中间件模块。

### 安装

`npm i -D @andremao/mockdb`

### 使用

1. 在项目的**根目录下**新建目录 `mockdb/mock`

   1. 在此目录下创建的所有 `*.js` 文件都将自动识别为 `mockdb` 配置文件
   2. 持久化的 `*.json` 文件，会自动生成在 `mockdb/db/*.json` 下，文件名与 `mockdb` 配置文件名一致

2. `mockdb` 配置文件内容如下：

   ```javascript
   const Mock = require('mockjs');
   const path = require('path');
   
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
         tpl: {
           code: 200,
           message: '获取用户列表成功',
           'data|1-10': [
             { id: '@ID()', name: '@CNAME()', email: '@EMAIL()' }
           ],
         },
       },
       {
         type: 'get',
         // 支持动态路由参数
         url: '/user/:id',
         tpl: {
           code: 200,
           message: '获取用户成功',
           data: { id: '@ID()', name: '@CNAME()', email: '@EMAIL()' },
         },
       },
       {
         type: 'put',
         url: '/user/:id',
         handle(req, res, next) {
           // 可以通过 req.query 获取查询参数
           console.log(req.query, 'req.query')
           // 可以通过 req.params 获取动态路由参数
           console.log(req.params, 'req.params');
           // 可以通过 req.body 获取请求体数据
           console.log(req.body, 'req.body');
           
           const { id } = req.params;
           const data = Mock.mock({
             code: 200,
             message: '用户更新成功',
             data: { id, ...req.body },
           });
           res.json(data);
         },
       },
     ],
   };
   ```

   补充：

   1. `tpl` 请参照 [mockjs](http://mockjs.com/) 的 `template` 格式
   2. `handle` 的优先级高于 `tpl`，配置了 `handle` 就会忽略 `tpl`

3. 在 vue 中使用，修改 `vue.config.js` 配置文件：

   ```javascript
   module.exports = {
     devServer: {
       before(app) {
         // 判断是否为开发环境
         if (process.env.NODE_ENV.toUpperCase() === 'DEVELOPMENT') {
           // 安装，挂上中间件
   				require('@andremao/mockdb').install(app);
         }
       },
     },
   };
   ```

4. 重启项目即可，并支持热加载，后续改动 `mockdb/mock/*.js` 与 `mockdb/db/*.json` 文件无需重启

5. 配合 `axios` 的请求拦截器，可以实现 mock 环境 与 线上环境 混搭

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

   