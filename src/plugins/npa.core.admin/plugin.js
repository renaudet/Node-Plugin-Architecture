/*
 * plugin.js - Administrative features for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();

plugin.checkInstallationHandler = function(req,res){
	plugin.debug('->checkInstallationHandler()');
	res.set('Content-Type','application/json');
	var query = {};
	if(typeof req.body=='object'){
		query = req.body;
	}
	let runtimeMap = plugin.runtime.map;
	if(query.pluginId){
		let p = runtimeMap[query.pluginId];
		if(typeof p=='undefined'){
			plugin.debug('<-checkInstallationHandler() - success - single');
			res.json({"status": 200,"message": query.pluginId,"data": []});
		}else{
			plugin.debug('<-checkInstallationHandler() - success - single');
			res.json({"status": 200,"message": query.pluginId,"data": [query.pluginId]});
		}
	}else{
		let ids = [];
		for(var id in runtimeMap){
			ids.push(id);
		}
		plugin.debug('<-checkInstallationHandler() - success - multiple');
		res.json({"status": 500,"message": "all","data": ids});
	}
}

module.exports = plugin;