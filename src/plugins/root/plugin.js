/*
 * plugin.js - Node Plugin Architecture root plugin
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();
plugin.applications = {};

plugin.plug = function(extender,extensionPointConfig){
	this.applications[extensionPointConfig.name] = extender;
}

plugin.getApplication = function(name){
	return this.applications[name];
}

module.exports = plugin;