'use strict';
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const _ = require('lodash.get');
const Archive = require('archive-tool');
const tool = require('node-tool-utils');
const Boilerplate = require('./init');
const builder = require('./builder');
const utils = require('./utils');

module.exports = class Action {
  constructor(command) {
    this.command = command;
    this.program = command.program;
    this.baseDir = command.baseDir;
  }

  /**
   * 初始化项目配置,可选择初始化不同技术栈模板
   *
   * @param   {[type]}  boilerplate  选择项目模板
   * @param   {[type]}  options      项目配置项
   *
   * @return  {[type]}               [return description]
   */
  init(boilerplate, options) {
    if (options.sync) { //同步最新的cli配置
      const filepath = path.resolve(__dirname, 'ask-sync.js');
      const url = options.sync === true ? process.env.EASY_INIT_ASK_URL || 'https://raw.githubusercontent.com/easy-team/easywebpack-cli/master/lib/ask.js' : options.sync;
      utils.request(url).then(res => {
        fs.writeFileSync(filepath, res.data);
        console.log(`${chalk.green('easy sync successfully, please run [easy init] again')}`);
      }).catch(err => {
        console.log(chalk.red('easy sync error:'), err);
      });
    } else {
      return new Boilerplate(boilerplate).init(options);
    }
  }

  /**
   * 安装依赖
   *
   * @param   {[type]}  options  配置项
   *
   * @return  {[type]}           [return description]
   */
  install(options) {
    const config = utils.initWebpackConfig(this.program, { //获取初始化webpack配置
      install: {
        check: true,
        npm: options.mode || 'npm'
      }
    });
    builder.getWebpackConfig(config);
  }

  /**
   * 启动开发模式
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  dev(options) {
    const config = utils.initWebpackConfig(this.program, options);
    builder.server(config);
  }

  /**
   * 启动开发模式
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  start(options) {
    const config = utils.initWebpackConfig(this.program, options);
    builder.server(config);
  }

  /**
   * 构建项目
   *
   * @param   {[type]}  env      [env description]
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  build(env, options) {
    const config = utils.initWebpackConfig(this.program, { env, cliDevtool : options.devtool}, { speed: options.speed });
    // 编译完成, 启动 HTTP Server 访问静态页面
    if (options.server) {
      const done = config.config.done;
      config.config.done = (multiCompiler, compilation) => {
        done && done(multiCompiler, compilation);
        const compiler = multiCompiler.compilers.find(item => {
          return item.options.target === 'web';
        });
        if (compiler) { // 自动解析 output.path
          const dist = compiler.options.output.path;
          const port = options.server === true ? undefined : options.server;
          tool.httpServer({
            dist,
            port
          });
        }
      };
    }
    builder.build(config);
  }

  /**
   * dll 使用dll(动态链接库)构建方式构建项目
   *
   * @param   {[type]}  env      [env description]
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  dll(env, options) {
    const config = utils.initWebpackConfig(program, { env, framework: 'dll' }, { dll: true });
    builder.build(config);
  }

  /**
   * //error: zsh: no matches found
   * 1.在 ~/.zshrc 中加入：setopt no_nomatch 
   * 2.执行 source ~/.zshrc
   * @param {*} env 
   * @param {*} options 
   */
  print(env, options) {
    const config = utils.initWebpackConfig(this.program, { env });
    const webpackConfig = builder.getWebpackConfig(config);
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : (webpackConfig ? [webpackConfig] : []);
    if (webpackConfigList.length) {
      const key = options.key || options.node;
      if (key) {
        webpackConfigList.forEach(item => {
          console.log(chalk.green(`easywebpack-cli: webpack ${this.program.type || item.target || ''} ${key} info:\r\n`), _(item, key));
        });
      } else {
        console.log(chalk.green('easywebpack-cli: webpack config info:\r\n'), webpackConfig);
      }
    } else {
      console.warn(chalk.yellow('easywebpack-cli: webpack config is empty'));
    }
  }

  /**
   * 启动 http server 服务
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  server(options) {
    tool.httpServer(options);
  }

  /**
   * 压缩成zip文件
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  zip(options) {
    const config = utils.initArchiveOption(this.baseDir, this.program, options);
    const archive = new Archive(config);
    archive.zip();
  }

  /**
   * 压缩成tar文件
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  tar(options) {
    const config = utils.initArchiveOption(this.baseDir, this.program, options);
    const archive = new Archive(config);
    archive.tar();
  }

  /**
   * deploy 部署
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  deploy(options) {
    console.log('doing.....');
  }

  /**
   * 升级依赖库
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  upgrade(options) {
    if (options.babel) {
      require('./babel')(this.baseDir, options);
    } else {
      require('./upgrade')(this.baseDir, options);
    }
  }

  /**
   * 清除缓存
   *
   * @param   {[type]}  dir  [dir description]
   *
   * @return  {[type]}       [return description]
   */
  clean(dir) {
    if (dir === 'all') {
      utils.clearTempDir(this.baseDir);
      utils.clearManifest(this.baseDir);
      utils.clearBuildDir(this.baseDir);
    } else if (dir) {
      tool.rm(dir);
    } else {
      utils.clearTempDir(this.baseDir);
    }
  }

  /**
   * kill 进程
   *
   * @param   {[type]}  port  [port description]
   *
   * @return  {[type]}        [return description]
   */
  kill(port) {
    tool.kill(port || '7001,9000,9001');
  }

  /**
   * 打开缓存文件
   *
   * @param   {[type]}  dir  [dir description]
   *
   * @return  {[type]}       [return description]
   */
  open(dir) {
    const filepath = dir ? dir : utils.getCompileTempDir(this.baseDir);
    tool.open(filepath);
    process.exit();
  }

  /**
   * debug
   *
   * @return  {[type]}  [return description]
   */
  debug() {
    // console.log(chalk.yellow('[debug] command not implemented'));
  }

  /**
   * test
   *
   * @return  {[type]}  [return description]
   */
  test() {
    // console.log(chalk.yellow('[test] command not implemented'));
  }

  /**
   * cov
   *
   * @return  {[type]}  [return description]
   */
  cov() {
    // console.log(chalk.yellow('[cov] command not implemented'));
  }

  /**
   * add
   *
   * @return  {[type]}  [return description]
   */
  add() {
    // console.log(chalk.yellow('[add] command not implemented'));
  }
};