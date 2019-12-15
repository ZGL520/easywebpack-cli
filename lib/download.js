'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const urllib = require('urllib');
const assert = require('assert');
const shell = require('shelljs');
const chalk = require('chalk');
const ora = require('ora');
const compressing = require('compressing');
const rimraf = require('mz-modules/rimraf');
const mkdirp = require('mz-modules/mkdirp');
const co = require('co');
const utils = require('./utils');
const DEPS_MAPPING = {
  scss: {
    'node-sass': '^4.5.3',
    'sass-loader': '^6.0.6'
  },
  less: {
    'less': '^2.7.2',
    'less-loader': '^4.0.0'
  },
  stylus: {
    'stylus': '^0.54.5',
    'stylus-loader': '^3.0.0'
  }
};
// 参考 egg-init 实现
module.exports = class Download {
  constructor(config = {}) {
    this.tempDir = path.join(os.tmpdir(), 'easywebpack-cli-init');
    this.registry = config.registry || 'https://registry.npmjs.org';
  }

  /**
   * 根据pkgName获取模板信息
   */
  *getPackageInfo(pkgName) {
    utils.log(`query npm info of ${pkgName}`, 'yellow');
    const url = `${this.registry}/${pkgName}/latest`;
    try {
      const result = yield urllib.request(url, {
        dataType: 'json',
        followRedirect: true,
        timeout: 30000
      });
      assert(result.status === 200, `npm info ${pkgName} got error: ${result.status}, ${result.data.reason}`);
      return result.data;
    } catch (err) {
      /* istanbul ignore next */
      throw err;
    }
  }

  /**
   * 下载模板文件并解压到临时文件夹保存起来
   */
  *download(pkgName, dir) {
    const result = yield this.getPackageInfo(pkgName);//获取模板信息
    const tgzUrl = result.dist.tarball;
    yield rimraf(this.tempDir);//清空临时文件夹

    utils.log(`downloading ${tgzUrl}`, 'yellow');
    const response = yield urllib.request(tgzUrl, { streaming: true, followRedirect: true });//下载模板
    const targetDir = path.join(this.tempDir, pkgName);//连接目标文件
    yield compressing.tgz.uncompress(response.res, targetDir); //解压到目标文件

    utils.log(`extract to ${this.tempDir}`, 'yellow');
    return path.join(targetDir, 'package', dir);
  }

  /**
   * 复制文件,可复制隐藏文件
   *
   * @param   {[type]}  sourceDir  [sourceDir description]
   * @param   {[type]}  targetDir  [targetDir description]
   * @param   {[type]}  option     [option description]
   *
   * @return  {[type]}             [return description]
   */
  copy(sourceDir, targetDir, option = { dir: '', hide: true }) {
    if (option.dir) {
      shell.cp('-R', path.join(sourceDir, option.dir), targetDir);
    } else {
      shell.cp('-R', path.join(sourceDir, '*'), targetDir);
      if (option.hide) { // copy hide file
        try {
          shell.cp('-R', path.join(sourceDir, '.*'), targetDir);
        } catch (e) {
          /* istanbul ignore next */
          console.warn('copy hide file error', e);
        }
      }
    }
  }

  writeFile(filepath, content) {
    try {
      fs.writeFileSync(filepath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
    } catch (e) {
      /* istanbul ignore next */
      console.error(`writeFile ${filepath} err`, e);
    }
  }

  /**
   * 更加配置信息更新项目信息,package.json
   *
   * @param   {[type]}  fileDir  [fileDir description]
   * @param   {[type]}  info     [info description]
   *
   * @return  {[type]}           [return description]
   */
  updatePackageFile(fileDir, info = {}) {
    const { name, description, style } = info;
    const filepath = path.join(fileDir, 'package.json');
    const packageJSON = require(filepath);
    const { devDependencies ={}, webpack = {} } = packageJSON;
    webpack.loaders = webpack.loaders || {};

    packageJSON.name = name || packageJSON.name;
    packageJSON.version = '1.0.0';
    packageJSON.description = description || packageJSON.description;
    if (style) {
      webpack.loaders[style] = true;
      Object.keys(DEPS_MAPPING[style]).forEach(depsName => {
        devDependencies[depsName] = DEPS_MAPPING[style][depsName];
      });
    }
    packageJSON.devDependencies = devDependencies;
    packageJSON.webpack = webpack;
    
    this.writeFile(filepath, packageJSON);
  }

  /**
   * 安装项目依赖库
   *
   * @param   {[type]}  projectDir  [projectDir description]
   * @param   {[type]}  info        [info description]
   *
   * @return  {[type]}              [return description]
   */
  installDeps(projectDir, info) {
    const { npm } = info;
    if (npm) {
      const cmd = `${npm} install`;
      const spinner = ora(utils.log(`start ${cmd}...`));
      spinner.start()
      const result = shell.exec(cmd, { cwd: projectDir, stdio: ['inherit'] });
      if (result) {
        if (result.code === 0) {
          utils.log(`${cmd} successfully!`);
        } else {
          console.log(chalk.red(`${cmd} error`), result.stderr);
        }
      }
      spinner.stop();
    }
  }

  copyTemplate(targetDir) {
    const sourceDir = path.resolve(__dirname, '../template');
    if (fs.existsSync(sourceDir)) {
      this.copy(sourceDir, targetDir, { hide: true });
    }
  }

  /**
   * 快速开始提示
   *
   * @param   {[type]}  projectName  [projectName description]
   * @param   {[type]}  info         [info description]
   *
   * @return  {[type]}               [return description]
   */
  quickStart(projectName, info) {
    let i = 1;
    const { npm, run } = info;
    const steps = [`${i}) cd ${projectName}`];
    if (!npm) {
      i++;
      steps.push(`${i}) npm install or yarn install`);
    }
    i++;
    steps.push(`${i}) ${run || 'npm run dev or npm start' }`);

    utils.log(`Now, start coding by follow step:\r\n${steps.join('\r\n')}`);
  }

  /**
   * 初始化项目
   *
   * @param   {[type]}  root               [root description]
   * @param   {[type]}  bilerplateInfo     [bilerplateInfo description]
   * @param   {[type]}  projectInfoAnswer  [projectInfoAnswer description]
   * @param   {[type]}  options            [options description]
   *
   * @return  {[type]}                     [return description]
   */
  init(root, bilerplateInfo, projectInfoAnswer = {}, options = {}) {
    const self = this;
    const { pkgName, sourceDir = '', run, value } = bilerplateInfo;
    const { name, npm } = projectInfoAnswer;
    const projectName = name || value || pkgName;

    //初始化项目
    co(function *() {
      const absSourceDir = yield self.download(pkgName, sourceDir);//下载模板文件
      const absTargetDir = path.join(root, projectName);//连接项目文件根目录
      yield mkdirp(absTargetDir);//创建项目文件夹
      self.copy(absSourceDir, absTargetDir);//copy模板文件到项目文件夹
      self.copyTemplate(absTargetDir); // copy模板
      self.updatePackageFile(absTargetDir, projectInfoAnswer); // 更新项目信息
      utils.log(`init ${projectName} project successfully!\r\n`);
      self.installDeps(absTargetDir, { npm }); // 安装项目依赖库
      self.quickStart(projectName, { npm, run }); //快速开始提示
    }).catch(err => {
      /* istanbul ignore next */
      console.log('init error', err);
    });
  }
};
