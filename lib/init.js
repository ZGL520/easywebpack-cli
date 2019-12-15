'use strict';
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const Download = require('./download');

module.exports = class Boilerplate {
  constructor(config = {}) {
    this.config = config;
    this.projectDir = process.cwd();
    this.ask = this.initAsk();
    this.boilerplateChoice = config.boilerplateChoice || this.ask.boilerplateChoice;
    this.boilerplateDetailChoice = config.boilerplateDetailChoice || this.ask.boilerplateDetailChoice;
    this.projectAskChoice = config.projectAskChoice || this.ask.projectAskChoice;
  }

  /**
   * 获取初始化配置选项信息
   *
   * @return  {[type]}  [return description]
   */
  initAsk() {
    const asksync = path.resolve(__dirname, 'ask-sync.js');
    if (fs.existsSync(asksync)) {
      try {
        return require(asksync);
      } catch(err) {
        console.log(chalk.red('[easywebpack-cli] init sync error'), err);
      }
    }
    return require('./ask');
  }

  /**
   * 根据模板名字获取模板信息
   *
   * @param   {[type]}  name  [name description]
   *
   * @return  {[type]}        [return description]
   */
  getBoilerplateInfo(name) {
    return this.boilerplateChoice.find(item => {
      return name === item.value;
    });
  }

  setBoilerplateInfo(boilerplateChoice) {
    this.boilerplateChoice = boilerplateChoice;
  }

  /**
   * 获取模板分支信息
   *
   * @param   {[type]}  boilerplate  [boilerplate description]
   * @param   {[type]}  project      [project description]
   *
   * @return  {[type]}               [return description]
   */
  getBoilerplateDetailInfo(boilerplate, project) {
    const filterItems = this.boilerplateDetailChoice[boilerplate].filter(item => project === item.value);
    return filterItems.length > 0 ? filterItems[0] : null;
  }

  setBoilerplateDetailInfo(boilerplateDetailChoice) {
    this.boilerplateDetailChoice = boilerplateDetailChoice;
  }

  setProjectAskChoice(projectAskChoice) {
    this.projectAskChoice = projectAskChoice;
  }

  /**
   * 获取项目配置信息
   *
   * @param   {[type]}  ranges  [ranges description]
   *
   * @return  {[type]}          [return description]
   */
  getProjectAskChoices(ranges){
    if (ranges === undefined) {
      return this.projectAskChoice;
    }
    return ranges.map(range => {
      return this.projectAskChoice.filter(choice => {
        return choice.name === range;
      })[0];
    });
  }

  /**
   * 初始化模板
   *
   * @param   {[type]}  options  [options description]
   *
   * @return  {[type]}           [return description]
   */
  init(options) {
    inquirer.prompt([{ // 选择模板
      type: 'list',
      name: 'boilerplateName',
      message: 'please choose the boilerplate mode?',
      choices: this.boilerplateChoice
    }]).then(boilerplateAnswer => {
      const boilerplateName = boilerplateAnswer.boilerplateName;
      const boilerplateInfo = this.getBoilerplateInfo(boilerplateName);//获取选择模板信息
      const choices = boilerplateInfo.choices;
      const download = new Download(options);
      if (this.boilerplateDetailChoice[boilerplateName]) {
        const boilerplateDetailAsk = [{ //如果存在分支,选择模板分支
          type: 'list',
          name: 'project',
          message: 'please choose the boilerplate project mode?',
          choices: this.boilerplateDetailChoice[boilerplateName]
        }];
        inquirer.prompt(boilerplateDetailAsk).then(boilerplateDetailAnswer => { //获得模板分支选择信息
          const project = boilerplateDetailAnswer.project;
          const bilerplateInfo = this.getBoilerplateDetailInfo(boilerplateName, project);
          const projectInfoChoice = this.getProjectAskChoices(bilerplateInfo.choices || choices);
          inquirer.prompt(projectInfoChoice).then(projectInfoAnswer => {
            download.init(this.projectDir, bilerplateInfo, projectInfoAnswer);//下载并创建项目
          });
        });
      } else { //如果没有分支
        const pkgName = boilerplateInfo.pkgName || boilerplateName;
        const projectInfoChoice = this.getProjectAskChoices(choices);
        inquirer.prompt(projectInfoChoice).then(projectInfoAnswer => {
          const specialBoilerplateInfo = { pkgName, run: boilerplateInfo.run };
          download.init(this.projectDir, specialBoilerplateInfo, projectInfoAnswer);//下载并创建项目
        });
      }
    });
  };
};