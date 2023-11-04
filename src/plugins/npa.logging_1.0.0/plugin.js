/*
 * plugin.js - logging provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const fs = require('fs'); 
const moment = require('moment');

const ENV_LOG_DIR = 'LOG_DIR';
const ENV_LOG_LEVEL = 'LOG_LEVEL';
const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const DEFAULT_LOG_FILENAME = 'plugin.out.log';
const DEFAULT_ERROR_FILENAME = 'plugin.err.log';

var plugin = new Plugin();
plugin.mode = 'info';
plugin.logDir = null;
plugin.loggers = {};

plugin.onConfigurationLoaded = function(){
	this.logDir = process.env[ENV_LOG_DIR];
	this.mode = process.env[ENV_LOG_LEVEL];
	console.log('logs directory set to '+this.logDir);
}
plugin.plug = function(extender,extensionPointConfig){
	var loggerConfig = {};
	loggerConfig.dir = extensionPointConfig.dir;
	loggerConfig.plugin = extender;
	this.loggers[extensionPointConfig.id] = loggerConfig;
	var path = this.logDir+'/'+loggerConfig.dir;
	fs.mkdirSync(path,{"recursive": true});
	extender.setLogger({
		log: function(level,text){
			plugin.log(extensionPointConfig.id,level,text);
		}
	});
}
plugin.formatLog = function(msg){
	return moment().format(DATE_TIME_FORMAT)+' '+msg+'\n';
}
plugin.doLog = function(level){
	if('error'==level || 'info'==level){
		return true;
	}
	if(('fine'==this.mode && 'debug'==level) || 
	   ('finest'==this.mode && ('debug'==level || 'trace'==level))){
		return true;
	}
	return false;
}
plugin.log = function(sourceId,level,text){
	if(this.doLog(level)){
		var loggerConfig = this.loggers[sourceId];
		if(typeof loggerConfig!='undefined'){
			var targetFilename = this.logDir+'/'+loggerConfig.dir+'/'+('error'==level?DEFAULT_ERROR_FILENAME:DEFAULT_LOG_FILENAME);
			var formatedTrace = this.formatLog(text);
			fs.appendFileSync(targetFilename,formatedTrace);
		}else{
			//ignore for now
		}
	}
}

module.exports = plugin;