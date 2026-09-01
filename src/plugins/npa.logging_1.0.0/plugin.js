/*
 * plugin.js - logging provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const fs = require('fs'); 
const moment = require('moment');
const readline = require('node:readline');

const ENV_LOG_DIR = 'LOG_DIR';
const ENV_LOG_LEVEL = 'LOG_LEVEL';
const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const DEFAULT_LOG_FILENAME = 'plugin.out.log';
const DEFAULT_ERROR_FILENAME = 'plugin.err.log'; 

var plugin = new Plugin();
plugin.mode = 'info';
plugin.logDir = null;
plugin.loggers = {};

plugin.beforeExtensionPlugged = function(){
	this.logDir = process.env[ENV_LOG_DIR];
	this.mode = process.env[ENV_LOG_LEVEL];
	console.log('logs directory set to '+this.logDir);
	console.log('base logging mode set to '+this.mode);
	let defaultLoggerConfig = {
		initialized: true,
		logger: {
			log: function(level,text){
				console.log('->defaultLoggerConfig#log()');
				if(plugin.doLog(level)){
					console.log('['+level+'] '+text);
				}
				console.log('<-defaultLoggerConfig#log()');
			}
		}
	};
	this.loggers['default'] = defaultLoggerConfig;
}

plugin.getLoggingPlugins = function(){
	let result = [];
	for(var id in this.loggers){
		result.push(id);
	}
	return result;
}

plugin.getLogLevel = function(pluginId){
	let targetPlugin = this.runtime.getPlugin(pluginId);
	if(targetPlugin){
		if(typeof targetPlugin.logLevel=='undefined'){
			targetPlugin.logLevel = this.mode;
			targetPlugin.info(pluginId+': log level set to '+targetPlugin.logLevel);
		}
		return targetPlugin.logLevel;
	}
	return 'undefined';
}

plugin.setLogLevel = function(pluginId,level){
	let targetPlugin = this.runtime.getPlugin(pluginId);
	if(targetPlugin){
		targetPlugin.logLevel = level;
		targetPlugin.info('log level set to '+level);
		return true;
	}
	return false;
}

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	var loggerConfig = {};
	loggerConfig.initialized = false;
	loggerConfig.dir = extensionPointConfig.dir;
	loggerConfig.logger = {
		id: extenderId,
		log: function(level,text){
			if('error'==level || 'info'==level){
				plugin.log2(extenderId,level,text);
			}else{
				let targetPlugin = plugin.runtime.getPlugin(this.id);
				let authorizedPluginLevel = targetPlugin.logLevel;
				if(typeof authorizedPluginLevel=='undefined'){
					targetPlugin.logLevel = plugin.mode;
					targetPlugin.info('log level set to '+targetPlugin.logLevel);
					authorizedPluginLevel = targetPlugin.logLevel;
				}
				if(('fine'==authorizedPluginLevel && 'debug'==level) || 
				   ('finest'==authorizedPluginLevel && ('debug'==level || 'trace'==level))){
					plugin.log2(extenderId,level,text);
				}
			}
		},
		canLog: function(level){
			if('error'==level || 'info'==level){
				return true;
			}else{
				let targetPlugin = plugin.runtime.getPlugin(this.id);
				let authorizedPluginLevel = targetPlugin.logLevel;
				if(typeof authorizedPluginLevel=='undefined'){
					targetPlugin.logLevel = plugin.mode;
					targetPlugin.info(this.id+': log level set to '+targetPlugin.logLevel);
					authorizedPluginLevel = targetPlugin.logLevel;
				}
				if(('fine'==authorizedPluginLevel && 'debug'==level) || 
				   ('finest'==authorizedPluginLevel && ('debug'==level || 'trace'==level))){
					return true;
				}
				return false;
			}
		}
	};
	this.loggers[extenderId] = loggerConfig;
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

const MAX_ROTATED_FILES = 5;
plugin.rotateIfNeeded = function(filename){
	try{
		let stat = fs.statSync(filename);
		if(stat.size >= this.getConfigValue('logging.maxSize','integer')){
			// shift .4→.5, .3→.4, .2→.3, .1→.2  (oldest .5 is silently dropped)
			for(var i=MAX_ROTATED_FILES-1;i>=1;i--){
				try{ fs.renameSync(filename+'.'+i, filename+'.'+(i+1)); }catch(e){}
			}
			// current log becomes .1
			fs.renameSync(filename, filename+'.1');
		}
	}catch(e){
		// file does not exist yet — nothing to rotate
	}
}

plugin.log2 = function(sourceId,level,text){
	var loggerConfig = this.loggers[sourceId];
	if(typeof loggerConfig!='undefined'){
		var targetFilename = this.logDir+'/'+loggerConfig.dir+'/'+('error'==level?DEFAULT_ERROR_FILENAME:DEFAULT_LOG_FILENAME);
		this.rotateIfNeeded(targetFilename);
		var formatedTrace = this.formatLog(text);
		fs.appendFileSync(targetFilename,formatedTrace);
	}
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

plugin.getLogger = function(pluginId){
	let loggerConfig = this.getLoggerConfig(pluginId);
	return loggerConfig.logger;
}

plugin.getLoggerConfig = function(pluginId){
	let loggerConfig = this.loggers[pluginId];
	if(typeof loggerConfig!='undefined'){
		if(!loggerConfig.initialized){
			let path = this.logDir+'/'+loggerConfig.dir;
			fs.mkdirSync(path,{"recursive": true});
			loggerConfig.initialized = true;
			loggerConfig.logger.log('info','logger initialized - traces will be sent to '+path);
		}
		return loggerConfig;
	}else{
		return this.loggers['default'];
	}
}

const DEFAULT_PAGE_SIZE = 100;
plugin.readLogContent = function(filename,offset,limit,then){
	const fileStream = fs.createReadStream(filename);
	let reader = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});
	let allLines = [];
	reader.on('line', function(line){
		allLines.push(line);
	})
	.on('error', function(e){
		then(['an error occured reading file '+filename]);
	})
	.on('close', function(){
		// window from the end: offset=0 means the very last lines
		let total = allLines.length;
		let start = Math.max(0, total - offset - limit);
		let end   = Math.max(0, total - offset);
		then(allLines.slice(start, end));
	});
}

plugin.readStandardLogContent = function(pluginId,then,offset=0,limit=DEFAULT_PAGE_SIZE){
	var loggerConfig = this.getLoggerConfig(pluginId);
	if(typeof loggerConfig!='undefined'){
		if(loggerConfig.initialized && typeof loggerConfig.dir!='undefined'){
			let path = this.logDir+'/'+loggerConfig.dir+'/'+DEFAULT_LOG_FILENAME;
			this.readLogContent(path,offset,limit,then);
		}else{
			then([]);
		}
	}else{
		then([]);
	}
}

plugin.readErrorLogContent = function(pluginId,then,offset=0,limit=DEFAULT_PAGE_SIZE){
	var loggerConfig = this.getLoggerConfig(pluginId);
	if(typeof loggerConfig!='undefined'){
		if(loggerConfig.initialized && typeof loggerConfig.dir!='undefined'){
			let path = this.logDir+'/'+loggerConfig.dir+'/'+DEFAULT_ERROR_FILENAME;
			this.readLogContent(path,offset,limit,then);
		}else{
			then([]);
		}
	}else{
		then([]);
	}
}

module.exports = plugin;