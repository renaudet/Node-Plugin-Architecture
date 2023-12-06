/*
 * plugin.js - Default (sample) application for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const ENV_NAME = 'APPLICATION_NAME';

var plugin = new Plugin();

plugin.initialize = function(){
	this.name = process.env[ENV_NAME];
	this.info('MyApp Application "'+this.name+'" starting...');
	var httpListener = this.runtime.getPlugin('npa.http');
	httpListener.startListener();
}

plugin.helloRequestHandler = function(req,res){
	plugin.debug('->helloRequestHandler');
	res.set('Content-Type','application/json');
	plugin.debug('<-helloRequestHandler');
	res.json({"status": 200,"message": "ok","data": "Hello, World! (from myApp)"});
}

module.exports = plugin;