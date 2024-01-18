/*
 * plugin.js - Node Plugin Architecture root plugin
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();
plugin.applications = {};
plugin.services = {};
plugin.activeApplicationName = null;

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('npa.core.application'==extensionPointConfig.point){
		this.debug('registering application '+extensionPointConfig.name+' from extension point '+extensionPointConfig.id);
		this.applications[extensionPointConfig.name] = extenderId;
	}
	if('npa.core.service'==extensionPointConfig.point){
		this.debug('registering service '+extensionPointConfig.service+' from extension point '+extensionPointConfig.id);
		this.services[extensionPointConfig.service] = extenderId;
	}
}

plugin.getApplication = function(name){
	this.debug('getApplication('+name+')');
	let appPluginId = this.applications[name];
	if(typeof appPluginId!='undefined'){
		this.trace('found application extension for "'+name+'" from plugin '+appPluginId);
		return this.runtime.getPlugin(appPluginId);
	}else{
		this.trace('no application extension found for name "'+name+'"');
		return null;
	}
}

plugin.startApplication = function(name){
	let app = this.getApplication(name);
	if(app!=null){
		this.info('Starting application "'+name+'"');
		this.activeApplicationName = name;
		app.start();
	}else{
		this.error('Unable to start application "'+name+'": not found!');
	}
}

plugin.getService = function(name){
	this.debug('getService('+name+')');
	let implPluginId = this.services[name];
	if(typeof implPluginId!='undefined'){
		this.trace('found service extension for "'+name+'" from plugin '+implPluginId);
		return this.runtime.getPlugin(implPluginId);
	}else{
		this.trace('no service extension found for name "'+name+'"');
		return null;
	}
}

module.exports = plugin;