/*
 * plugin.js - HTTP endpoint provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const express = require('express');
const expressWs = require('express-ws');
const moment = require('moment');
const COUCH_SERVICE_ID = 'couchdb';
const bodyParser = require('body-parser');
const ENV_PORT = 'PORT';
const ENV_NAME = 'APPLICATION_NAME';
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';

var plugin = new Plugin();
plugin.endpoint = null;
plugin.wsEndpoint = null;
plugin.routers = {};
plugin.commands = [];
plugin.homePage = null;
plugin.sessionStore = null;
plugin.providers = {"routers": {},"apis": []};

plugin.beforeExtensionPlugged = function(){
	process.title = process.env[ENV_NAME];
	this.endpoint = express();
	if(!this.getConfigValue('http.secure','boolean')){
		this.wsEndpoint = expressWs(this.endpoint);
	}
	this.endpoint.set('etag', false);
	this.endpoint.use(bodyParser.json());
	this.endpoint.use(bodyParser.urlencoded({ extended: true, limit: '500kb' }));
	if(this.config.http.corsEnabled){
		var cors = require('cors');
		this.endpoint.use(cors());
	}
	this.endpoint.use(bodyParser.text({ type: 'text/*' }));
	if(typeof this.config.http.session!='undefined' && this.config.http.session.enabled){
		let sessionConfig = this.config.http.session;
		var session = require('express-session');
		let sessionCookieName = this.getConfigValue('http.session.name');
		let persistentValue = this.getConfigValue('http.session.persistent');
		if(persistentValue=='true' || persistentValue==true){
			if('CouchSessionStore'==sessionConfig.store){
				let StoreClass = require('./couchdbSessionStore.js');
				let couchService = plugin.getService(COUCH_SERVICE_ID);
				var persistentStore = new StoreClass(couchService);
				let sessionMiddleware = session({
				  name: sessionCookieName,
				  secret: sessionConfig.secret,
				  resave: false,
				  saveUninitialized: true,
				  rolling: true,
				  cookie: { 
					secure: false,
					sameSite: 'strict'
				  },
				  store: persistentStore
				});
				
				this.endpoint.use(function(req, res, next){
					if(req.path.indexOf('.')>0 && !req.path.endsWith('.html')){
						next();
					}else{
						sessionMiddleware(req, res, next);
					}
				});
			}
		}else{
			this.endpoint.use(session({
			  name: sessionCookieName,
			  secret: sessionConfig.secret,
			  resave: false,
			  saveUninitialized: true,
			  rolling: true,
			  cookie: { 
				secure: false,
				sameSite: 'strict'
			  }
			}));
		}
		this.endpoint.use(function(req, res, next) {
			res.setHeader('X-Powered-By','NPA HttpServer v'+plugin.config.version);
			res.setHeader('Accept-Language',plugin.config.http.supportedLocale);
			if(req.path.indexOf('.')>0){
				next();
			}else{
				if(!plugin.sessionStore){
					plugin.sessionStore = req.sessionStore;
				}
				next();
			}
		});
	}else{
		this.endpoint.use(function(req, res, next) {
			res.setHeader('X-Powered-By','NPA HttpServer v'+plugin.config.version);
			res.setHeader('Accept-Language',plugin.config.http.supportedLocale);
		});
	}
	
}

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	this.trace('->lazzyPlug('+extenderId+','+extensionPointConfig.point+')');
	var wrapper = this.runtime.getPluginWrapper(extenderId);
	if('npa.http.router'==extensionPointConfig.point){
		var command = {};
		command.execute = function(){
			plugin.info('adding express router for path '+extensionPointConfig.path+' from #'+extensionPointConfig.id);
			plugin.routers[extensionPointConfig.id] = express.Router();
			plugin.endpoint.use(extensionPointConfig.path,plugin.routers[extensionPointConfig.id]);
		}
		this.commands.push(command);
		this.providers.routers[extensionPointConfig.id] = extensionPointConfig.path;
	}
	if('npa.http.ws.router'==extensionPointConfig.point){
		var command = {};
		command.execute = function(){
			plugin.info('adding express-ws router for path '+extensionPointConfig.path+' from #'+extensionPointConfig.id);
			plugin.routers[extensionPointConfig.id] = express.Router();
			plugin.endpoint.use(extensionPointConfig.path,plugin.routers[extensionPointConfig.id]);
		}
		this.commands.push(command);
		this.providers.routers[extensionPointConfig.id] = extensionPointConfig.path;
	}
	if('npa.http.ws.handler'==extensionPointConfig.point){
		var command = {};
		command.execute = function(){
			plugin.info('adding a WebSocket handler with schema '+extensionPointConfig.schema+' to route '+extensionPointConfig.router);
			var router = plugin.routers[extensionPointConfig.router];
			if(typeof router!="undefined"){
				let extender = wrapper.getPlugin();
				router.ws(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
			}else{
				this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
			}
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
					let extender = wrapper.getPlugin();
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
				plugin.info('adding a POST HTTP handler with schema '+extensionPointConfig.schema+' to router #'+extensionPointConfig.router);
				var router = plugin.routers[extensionPointConfig.router];
				if(typeof router!="undefined"){
					let extender = wrapper.getPlugin();
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
					let extender = wrapper.getPlugin();
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
					let extender = wrapper.getPlugin();
					router.delete(extensionPointConfig.schema,extender[extensionPointConfig.handler]);
				}else{
					this.error('router '+extensionPointConfig.router+' not found for extension point '+extensionPointConfig.id);
				}
			}
			this.commands.push(command);
		}
		this.providers.apis.push({"pluginId": extenderId,"api": extensionPointConfig});
	}
	if('npa.http.static'==extensionPointConfig.point){
		var path = extensionPointConfig.path;
		var dir = 	wrapper.getLocalDirectory()+'/'+extensionPointConfig.localDir;
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
		this.homePage = 'to-be-defined';
		var command = {};
		command.execute = function(){
			let core = plugin.runtime.getPlugin('npa.core');
			if(extensionPointConfig.application==core.activeApplicationName){
				plugin.info('adding Home page redirectiorn to '+extensionPointConfig.uri);
				plugin.homePage = extensionPointConfig.uri;
			}
		}
		this.commands.push(command);
	}
	this.trace('<-lazzyPlug()');
}

plugin.startListener = function(requiredPort=null){
	this.trace('->startListener()');
	console.log('Home page: '+this.homePage);
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
	
    let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
    propService.setProperty('http.service.port',port);
    propService.lockProperty('http.service.port');
	
	if(plugin.getConfigValue('http.secure','boolean')){
	    propService.setProperty('http.service.ssl.enabled',true);
	    propService.lockProperty('http.service.ssl.enabled');
		const https = require('https');
		const fs = require('fs');
		this.info('starting the HTTPS listener on port '+port);
		var options = {
		    key: fs.readFileSync(plugin.getConfigValue('http.security.privateKeyFile','string')),
		    cert: fs.readFileSync(plugin.getConfigValue('http.security.certificate','string'))
		};
		let server = https.createServer(options, this.endpoint);
		plugin.wsEndpoint = expressWs(this.endpoint,server);
		for(var i=0;i<this.commands.length;i++){
			var command = this.commands[i];
			try{
				command.execute();
			}catch(t){}
		}
		server.listen(port);
	}else{
	    propService.lockProperty('http.service.ssl.enabled');
		this.info('starting the HTTP listener on port '+port);
		for(var i=0;i<this.commands.length;i++){
			var command = this.commands[i];
			try{
				command.execute();
			}catch(t){}
		}
		this.endpoint.listen(port);
	}
	
	if(typeof this.config.http.session!='undefined' && this.config.http.session.enabled){
		let sessionConfig = this.config.http.session;
		setTimeout(function(){ plugin.checkSessions(); },plugin.getConfigValue('http.session.checkperiod','integer')*1000);
	}
	this.trace('<-startListener()');
}

plugin.checkSessions = function(){
	this.trace('->checkSessions()');
	var now = moment();
	this.trace('Session reaper thread begin ('+now.format('HH:mm:ss')+')...');
	if(this.sessionStore!=null){
		this.sessionStore.all(function(err,sessions){
			var sessionIdTable = [];
			for(var sessionId in sessions){
				sessionIdTable.push(sessionId);
			}
			plugin.debug('found '+sessionIdTable.length+' sessions in store');
			var checkSessionsById = function(sessionIdLst,index,then){
				if(index < sessionIdLst.length){
					var sessionId = sessionIdLst[index];
					plugin.debug('checking session ID#'+sessionId);
					plugin.sessionStore.get(sessionId,function(err,sessObj){
						if(err){
							plugin.error('sessionStore#get() returned an error:');
							plugin.error(JSON.stringify(err));
						}else{
							if(typeof sessObj!='undefined' && sessObj!=null){
								plugin.debug('last access: '+sessObj.lastAccess);
								plugin.debug('session is alive: '+sessObj.alive);
								if(sessObj.lastAccess && sessObj.alive){
									var inactivityPeriod = now.diff(sessObj.lastAccess);
									plugin.debug('inactivity period is: '+inactivityPeriod);
									if(inactivityPeriod>1000*plugin.getConfigValue('http.session.expires','integer')){
										plugin.info('-session ID #'+sessionId+' expired (created: '+moment(sessObj.created).format('HH:mm:ss')+')... Cleaning up!');
										plugin.sessionStore.destroy(sessionId);
									}
								}else{
									plugin.info('-session ID #'+sessionId+' is a ghost - cleaning');
									plugin.sessionStore.destroy(sessionId);
								}
							}else{
								plugin.debug('no session found with id #'+sessionId+' - assume it was just deleted');
							}
						}
						checkSessionsById(sessionIdLst,index+1,then);
					});
				}else{
					then();
				}
			}
			checkSessionsById(sessionIdTable,0,function(){
				plugin.trace('Session reaper thread end');
				setTimeout(function(){ plugin.checkSessions(); },plugin.getConfigValue('http.session.checkperiod','integer')*1000);
			});
		});
	}else{
		this.trace('Session reaper thread end');
		setTimeout(function(){ plugin.checkSessions(); },plugin.getConfigValue('http.session.checkperiod','integer')*1000);
	}
}

module.exports = plugin;