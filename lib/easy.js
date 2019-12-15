'use strict';
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const WebpackTool = require('webpack-tool');
const merge = WebpackTool.merge;
const utils = require('../lib/utils');
const BASE_SOLUTION = 'easywebpack';
const EASY_BASE_SOLUTION = '@easy-team/easywebpack';
const BASE_FRAMEWORKS = ['vue', 'react', 'weex', 'html', 'js'];

/**
 * 获取webpackConfig配置
 */
exports.getFramework = (filepath = 'webpack.config.js', baseDir) => {
  const root = baseDir || process.cwd();
  const webpackConfigFilePath = path.isAbsolute(filepath) ? filepath : path.resolve(root, filepath);//获取配置文件路径
  if (fs.existsSync(webpackConfigFilePath)) {
    const webpackConfig = require(webpackConfigFilePath);
    const { framework } = webpackConfig;
    if (framework) {
      return framework;
    }
  }
  const pkgFile = path.join(root, 'package.json');
  const pkg = require(pkgFile);
  const { framework } = pkg.webpack || {};
  if (framework) {
    return framework;
  }
  return BASE_FRAMEWORKS.find(framework => {
    const key = `${BASE_SOLUTION}-${framework}`;
    const easyPkg = pkg.dependencies && pkg.dependencies[key] || pkg.devDependencies && pkg.devDependencies[key];
    if (easyPkg) {
      return easyPkg;
    }
    const easyKey = `${EASY_BASE_SOLUTION}-${framework}`;
    return pkg.dependencies && pkg.dependencies[easyKey] || pkg.devDependencies && pkg.devDependencies[easyKey];
  });
};

exports.getWebpackBuilder = (framework, baseDir) => {
  const pkgName = framework ? `${BASE_SOLUTION}-${framework}` : BASE_SOLUTION;
  let builder = utils.getInstallPackage(pkgName, baseDir);//引入依赖包
  if (!builder) {//如果不存在则安装依赖包
    const command = shell.which('tnpm') ? 'tnpm' : 'npm';
    utils.log(`install [${pkgName}] start`);
    const result = shell.exec(`${command} i ${pkgName} -d`);
    if (result.code === 0) {
      utils.log(`install [ ${pkgName} ] success`);
    }
    builder = utils.getInstallPackage(pkgName, baseDir); //安装完再引入依赖包
  }
  return builder;
};

exports.install = options => {
  const registry = options.registry || 'https://registry.npmjs.org';
  const command = shell.which('tnpm') ? 'tnpm' : 'npm';
  const result = shell.exec(`${command} i --registry=${registry}`);
  if (result.code === 0) {
    utils.log('install success');
  }
};

exports.getEasy = cfg => {
  const { baseDir, cli } = cfg;
  const { filename } = cli;
  const framework = exports.getFramework(filename, baseDir);//获取webpackConfig配置
  const easy = exports.getWebpackBuilder(framework, baseDir);
  const options = merge({ cli, baseDir, framework }, cfg.config);//合并配置
  const config = easy.getConfig(filename, options);
  return { config, easy };
};

exports.getWebpackConfig = cfg => {
  const { config, easy } = exports.getEasy(cfg);
  if (cfg.cli.dll) {
    return easy.getDllWebpackConfig(config, cfg);
  }
  return easy.getWebpackConfig(config);
};

exports.build = cfg => {
  const { config, easy } = exports.getEasy(cfg);
  const build = () => {
    let webpackConfigList = easy.getWebpackConfig(config);
    if (cfg.cli.speed) {
      if (Array.isArray(webpackConfigList)) {
        webpackConfigList = webpackConfigList.map(webpackConfig => {
          return utils.createSpeedWebpackConfig(webpackConfig);
        });
      } else {
        webpackConfigList = utils.createSpeedWebpackConfig(webpackConfigList);
      }
    }
    easy.build(webpackConfigList, config, config.done);
  };

  // cli only build dll
  if (config && config.dll) {
    let dllWebpackConfig = easy.getDllWebpackConfig(config);
    if (dllWebpackConfig) {
      if (cfg.cli.speed) {
        dllWebpackConfig = utils.createSpeedWebpackConfig(dllWebpackConfig);
      }
      // only build cli
      if (cfg.cli.dll) {
        return easy.build(dllWebpackConfig, {});
      }
      return easy.build(dllWebpackConfig, {}, () => {
        // fix build twice
        return build();
      });
    }
  }
  return build();
};

/**
 * 启动web服务
 */
exports.server = cfg => {
  const { config, easy } = exports.getEasy(cfg);
  if (config && config.dll) {//判断是否有动态链接库
    const dllWebpackConfig = easy.getDllWebpackConfig(config);//获取动态链接库配置
    if (dllWebpackConfig) {
      return easy.build(dllWebpackConfig, {}, () => {
        const webpackConfigList = easy.getWebpackConfig(config); //获取webpackConfig配置
        easy.server(webpackConfigList, config, config.done);//启动服务
      });
    }
  }
  const webpackConfigList = easy.getWebpackConfig(config);
  return easy.server(webpackConfigList, config, config.done);
};