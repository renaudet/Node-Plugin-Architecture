/*
 * plugin.js - HTTP endpoint provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const express = require('express');
const bodyParser = require('body-parser');
const ENV_PORT = 'PORT';
const ENV_NAME = 'APPLICATION_NAME';

var plugin = new Plugin();
plugin.endpoint = null;
plugin.routers = {};

plugin.beforePlugExtensions = function(){
	this.endpoint = express();
	this.endpoint.set('etag', false);
	this.endpoint.use(bodyParser.json());
	this.endpoint.use(bodyParser.urlencoded({ extended: false }));
}

plugin.plug = function(extender,extensionPointConfig){
	if('npa.http.router'==extensionPointConfig.point){
		this.routers[extensionPointConfig.id] = express.Router();
		this.endpoint.use(extensionPointConfig.path,this.routers[extensionPointConfig.id]);
	}
	if('npa.http.handler'==extensionPointConfig.point){
		var router = this.routers[extensionPointConfig.router];
		if(typeof router!="undefined"){
			if('GET'==extensionPointConfig.method){
				router.get(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				this.info('adding a GET HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
			}
			if('POST'==extensionPointConfig.method){
				router.post(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				this.info('adding a POST HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
			}
			if('PUT'==extensionPointConfig.method){
				router.put(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				this.info('adding a PUT HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
			}
			if('DELETE'==extensionPointConfig.method){
				router.delete(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				this.info('adding a DELETE HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
			}
		}else{
			this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
		}
	}
	if('npa.http.static'==extensionPointConfig.point){
		var path = extensionPointConfig.path;
		var dir = 	extender.getLocalDirectory()+'/'+extensionPointConfig.localDir;
		this.info('adding static content endpoint "'+path+'" from directory '+dir);
		this.endpoint.use(path, express.static(dir));
	}
}

plugin.start = function(then){
	process.title = process.env[ENV_NAME];
	then();
}

plugin.startListener = function(){
	var port = this.config.http.port;
	if(typeof process.env[ENV_PORT]!='undefined'){
		port = process.env[ENV_PORT];
	}
	this.info('starting the HTTP listener on port '+port);
	this.endpoint.listen(port);
}

module.exports = plugin;