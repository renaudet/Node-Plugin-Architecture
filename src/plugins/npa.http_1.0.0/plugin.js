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
plugin.commands = [];
plugin.homePage = null;

plugin.beforePlugExtensions = function(){
	this.endpoint = express();
	this.endpoint.set('etag', false);
	this.endpoint.use(bodyParser.json());
	this.endpoint.use(bodyParser.urlencoded({ extended: false }));
}

plugin.plug = function(extender,extensionPointConfig){
	if('npa.http.router'==extensionPointConfig.point){
		var command = {};
		command.execute = function(){
			plugin.info('adding express router for path '+extensionPointConfig.path);
			plugin.routers[extensionPointConfig.id] = express.Router();
			plugin.endpoint.use(extensionPointConfig.path,plugin.routers[extensionPointConfig.id]);
		}
		this.commands.push(command);
	}
	if('npa.http.handler'==extensionPointConfig.point){
		if('GET'==extensionPointConfig.method){
			var command = {};
			command.execute = function(){
				plugin.info('adding a GET HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
				var router = plugin.routers[extensionPointConfig.router];
				if(typeof router!="undefined"){
					router.get(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				}else{
					this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
				}
			}
			this.commands.push(command);
		}
		if('POST'==extensionPointConfig.method){
			var command = {};
			command.execute = function(){
				plugin.info('adding a POST HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
				var router = plugin.routers[extensionPointConfig.router];
				if(typeof router!="undefined"){
					router.post(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				}else{
					this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
				}
			}
			this.commands.push(command);
		}
		if('PUT'==extensionPointConfig.method){
			var command = {};
			command.execute = function(){
				plugin.info('adding a PUT HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
				var router = plugin.routers[extensionPointConfig.router];
				if(typeof router!="undefined"){
					router.put(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				}else{
					this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
				}
			}
			this.commands.push(command);
		}
		if('DELETE'==extensionPointConfig.method){
			var command = {};
			command.execute = function(){
				plugin.info('adding a DELETE HTTP handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
				var router = plugin.routers[extensionPointConfig.router];
				if(typeof router!="undefined"){
					router.delete(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				}else{
					this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
				}
			}
			this.commands.push(command);
		}
	}
	if('npa.http.static'==extensionPointConfig.point){
		var path = extensionPointConfig.path;
		var dir = 	extender.getLocalDirectory()+'/'+extensionPointConfig.localDir;
		var command = {};
		command.execute = function(){
			plugin.info('adding static content endpoint "'+path+'" from directory '+dir);
			var options = {};
			if(plugin.homePage!=null){
				options.index = false;
				console.log('-index page will be '+options.index);
			}
			plugin.endpoint.use(path, express.static(dir,options));
		}
		this.commands.push(command);
	}
	if('npa.http.home'==extensionPointConfig.point){
		this.info('adding Home page redirectiorn to '+extensionPointConfig.uri);
		this.homePage = extensionPointConfig.uri;
	}
}

plugin.start = function(then){
	process.title = process.env[ENV_NAME];
	then();
}

plugin.startListener = function(requiredPort=null){
	for(var i=0;i<this.commands.length;i++){
		var command = this.commands[i];
		try{
			command.execute();
		}catch(t){}
	}
	if(this.homePage!=null){
		this.endpoint.get('/',function(req, res){
			res.redirect(plugin.homePage);
		});
	}
	var port = this.config.http.port; //default value
	if(requiredPort!=null){
		port = requiredPort;
	}else
	if(typeof process.env[ENV_PORT]!='undefined'){
		port = process.env[ENV_PORT];
	}
	this.info('starting the HTTP listener on port '+port);
	this.endpoint.listen(port);
}

module.exports = plugin;