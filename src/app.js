/*
 * app.js - launcher for a Node.js Plugin-based application
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */

const args = require('yargs').argv;
const config = require('./appConfig.json');
const Runtime = require('./core/integrationRuntime');

const ENV_APPLICATION = 'APPLICATION';
const ARGV_APPLICATION = 'application';
const APPLICATION_DEFAULT_VALUE = 'myApp';

const ENV_LOG_DIR = 'LOG_DIR';
const ARGV_LOG_DIR = 'logs';
const LOG_DIR_DEFAULT_VALUE = './logs';

const ENV_LOG_LEVEL = 'LOG_LEVEL';
const ARGV_LOG_LEVEL = 'level';
const LOG_LEVEL_DEFAULT_VALUE = 'info';

const ENV_PORT = 'PORT';
const ARGV_PORT = 'port';

const ENV_NAME = 'APPLICATION_NAME';
const ARGV_NAME = 'name';
const PROCESS_NAME_DEFAULT_VALUE = APPLICATION_DEFAULT_VALUE;
 
// get parameters from command-line to set environment variables

if(!process.env[ENV_APPLICATION]){
	if(args[ARGV_APPLICATION]){
		process.env[ENV_APPLICATION] = args[ARGV_APPLICATION];
	}else{
		process.env[ENV_APPLICATION] = APPLICATION_DEFAULT_VALUE;
	}
}

if(!process.env[ENV_LOG_DIR]){
	if(args[ARGV_LOG_DIR]){
		process.env[ENV_LOG_DIR] = args[ARGV_LOG_DIR];
	}else{
		process.env[ENV_LOG_DIR] = LOG_DIR_DEFAULT_VALUE;
	}
}

if(!process.env[ENV_LOG_LEVEL]){
	if(args[ARGV_LOG_LEVEL]){
		process.env[ENV_LOG_LEVEL] = args[ARGV_LOG_LEVEL];
	}else{
		process.env[ENV_LOG_LEVEL] = LOG_LEVEL_DEFAULT_VALUE;
	}
}

if(!process.env[ENV_PORT]){
	if(args[ARGV_PORT]){
		process.env[ENV_PORT] = args[ARGV_PORT];
	}
}

if(!process.env[ENV_NAME]){
	if(args[ARGV_NAME]){
		process.env[ENV_NAME] = args[ARGV_NAME];
	}else{
		process.env[ENV_NAME] = PROCESS_NAME_DEFAULT_VALUE;
	}
}

if(!process.env.NODE_PATH){
	console.log('NODE_PATH environment variable not set - Please add exports NODE_PATH = '+process.cwd()+'/node_modules to your launching script before starting the Node.js process');
}else{
	let integrator = new Runtime(config);
	let core = integrator.getPlugin('npa.core');
	core.startApplication(process.env[ENV_APPLICATION]);
}