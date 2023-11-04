/*
 * plugin.js - Node Plugin Architecture root plugin
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();
plugin.applications = {};

plugin.plug = function(extender,extensionPointConfig){
	var appType = this.applications[extensionPointConfig.type];
	if(typeof appType=='undefined'){
		appType = [];
		this.applications[extensionPointConfig.type] = appType;
	}
	appType.push(extender);
}

plugin.getApplications = function(type){
	return this.applications[type];
}

module.exports = plugin;