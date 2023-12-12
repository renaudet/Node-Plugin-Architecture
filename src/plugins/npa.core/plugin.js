/*
 * plugin.js - Node Plugin Architecture root plugin
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();
plugin.applications = {};
plugin.services = {};

plugin.plug = function(extender,extensionPointConfig){
	if('npa.core.application'==extensionPointConfig.point){
		this.debug('registering application '+extensionPointConfig.name+' from extension point '+extensionPointConfig.id);
		this.applications[extensionPointConfig.name] = extender;
	}
	if('npa.core.service'==extensionPointConfig.point){
		this.debug('registering service '+extensionPointConfig.service+' from extension point '+extensionPointConfig.id);
		this.services[extensionPointConfig.service] = extender;
	}
}

plugin.getApplication = function(name){
	return this.applications[name];
}

plugin.getService = function(name){
	return this.services[name];
}

module.exports = plugin;