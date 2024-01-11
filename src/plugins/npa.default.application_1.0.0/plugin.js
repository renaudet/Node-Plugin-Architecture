/*
 * plugin.js - Default (sample) application for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const ENV_NAME = 'APPLICATION_NAME';

var plugin = new Plugin();

plugin.start = function(){
	this.name = process.env[ENV_NAME];
	this.info('Application '+this.name+' starting...');
	let core = this.runtime.getPlugin('npa.core');
	let httpServer = core.getService('http');
	httpServer.startListener();
}

plugin.helloRequestHandler = function(req,res){
	plugin.debug('->helloRequestHandler');
	res.set('Content-Type','application/json');
	plugin.debug('<-helloRequestHandler');
	res.json({"status": 200,"message": "ok","data": "Hello, World!"});
}

module.exports = plugin;