/*
 * plugin.js - MCP Server core plugin for NPA
 * Copyright 2026 - All rights reserved
 *
 * This plugin:
 *  - starts an Express/Streamable-HTTP MCP server via npa.http
 *  - provides the "npa.mcp.tool" extension point so that other plugins
 *    can contribute tools either via a registrar function or via an apiId
 *    referencing a npa.http.handler extension that carries an "apidoc" field
 */
const Plugin = require('../../core/plugin.js');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const fs = require('fs');
const nodePath = require('path');
const moment = require('moment');
const MCP_EXTENSION_POINT_ID = 'npa.mcp.tool';
const TELEMETRY_SERVICE_NAME = 'telemetry';
const MCP_INVOCATION_DIMENSION = 'mcp.invocation.count';
const MCP_CONCURRENT_CLIENTS_DIMENSION = 'mcp.concurrent.clients';
const TELEMETRY_COLLECT_TIMEOUT = 30;

const MIME_TYPES = {
	'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
	'.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
	'.pdf': 'application/pdf', '.zip': 'application/zip',
	'.txt': 'text/plain', '.json': 'application/json',
	'.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css'
};

var plugin = new Plugin();

// Registry of tool registrar functions contributed via npa.mcp.tool extension point
plugin.toolRegistrars = [];

// Telemetry counters
plugin.invocationCount = 0;
plugin.concurrentClients = 0;
plugin.peakConcurrentClients = 0;

plugin.onConfigurationLoaded = function(){
	setTimeout(function(){ plugin.collectTelemetry(); },10*1000);
}

plugin.collectTelemetry = function(){
	this.trace('->collectTelemetry()');
	let telemetryService = this.getService(TELEMETRY_SERVICE_NAME);
	let timestamp = moment().format('YYYY/MM/DD HH:mm:ss');
	telemetryService.push(MCP_INVOCATION_DIMENSION,{"timestamp": timestamp,"count": this.invocationCount});
	telemetryService.push(MCP_CONCURRENT_CLIENTS_DIMENSION,{"timestamp": timestamp,"count": this.peakConcurrentClients});
	this.peakConcurrentClients = 0;
	this.trace('<-collectTelemetry()');
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

/*
 * Build a Zod schema from a JSON Schema "properties" map.
 * Only the types used by npa.mcp.tool descriptors are handled.
 */
plugin.buildZodSchema = function(properties, required) {
	this.debug('->buildZodSchema()');
	let shape = {};
	let requiredSet = new Set(required || []);
	for (let [name, def] of Object.entries(properties)) {
		let field;
		if (def.enum) {
			field = z.enum(def.enum);
		} else if (def.anyOf) {
			// anyOf with object/string alternatives — treat as a free-form object
			field = z.union([z.record(z.string(), z.any()), z.string()]);
		} else if (def.type === 'boolean') {
			field = z.boolean();
		} else if (def.type === 'integer' || def.type === 'number') {
			field = z.number();
		} else if (def.type === 'array') {
			field = z.array(z.any());
		} else if (def.type === 'object') {
			if (def.properties) {
				field = z.object(plugin.buildZodSchema(def.properties, def.required || [])).passthrough();
			} else {
				field = z.union([z.record(z.string(), z.any()), z.string()]);
			}
		} else {
			field = z.string();
		}
		if (def.description) {
			field = field.describe(def.description);
		}
		if (!requiredSet.has(name)) {
			field = field.optional();
		}
		shape[name] = field;
	}
	this.debug('<-buildZodSchema()');
	return shape;
};

/*
 * Build a registrar function from an OpenAPI "apidoc" descriptor.
 * The registrar forwards calls to the backing REST endpoint via HTTP.
 */
plugin.buildApiRegistrar = function(extenderId,extensionConfig) {
	plugin.debug('->buildApiRegistrar(' + extensionConfig.id + ')');
	let apidoc = extensionConfig.apidoc;
	let path = Object.keys(apidoc.paths)[0];
	let pathDef = apidoc.paths[path];
	let method = Object.keys(pathDef)[0];
	let operation = pathDef[method];
	let toolName = operation.operationId;
	let toolDescription = operation.description || operation.summary;
	let paramsProperties = {};
	let paramsRequired = [];
	let queryProperties = {};
	let queryRequired = [];
	let bodySchema = null;
	if (operation.parameters) {
		for (let param of operation.parameters) {
			let targetProps = param.in === 'query' ? queryProperties : paramsProperties;
			let targetRequired = param.in === 'query' ? queryRequired : paramsRequired;
			targetProps[param.name] = param.schema || { type: 'string' };
			if (param.description) targetProps[param.name].description = param.description;
			if (param.required) targetRequired.push(param.name);
		}
	}
	if (operation.requestBody) {
		bodySchema = operation.requestBody.content['application/json'].schema || { type: 'object' };
	}
	let topLevelProps = {};
	let topLevelRequired = [];
	if (Object.keys(paramsProperties).length > 0) {
		topLevelProps.params = { type: 'object', properties: paramsProperties, additionalProperties: false };
		if (paramsRequired.length > 0) topLevelProps.params.required = paramsRequired;
		if (paramsRequired.length > 0) topLevelRequired.push('params');
	}
	if (Object.keys(queryProperties).length > 0) {
		topLevelProps.query = { type: 'object', properties: queryProperties, additionalProperties: false };
		if (queryRequired.length > 0) topLevelProps.query.required = queryRequired;
	}
	if (bodySchema) {
		topLevelProps.body = bodySchema;
		if (operation.requestBody.required) topLevelRequired.push('body');
	}
	plugin.debug('registered MCP tool schema for ' + toolName + ' - sections=' + JSON.stringify(Object.keys(topLevelProps)) + ' required=' + JSON.stringify(topLevelRequired));
	plugin.trace('registered MCP tool schema payload for ' + toolName + ': ' + JSON.stringify(topLevelProps, null, '\t'));
	let zodShape = plugin.buildZodSchema(topLevelProps, topLevelRequired);
	plugin.debug('<-buildApiRegistrar()');
	return function(server, httpReq) {
		server.tool(toolName, toolDescription, zodShape, async (args) => {
			return new Promise((resolve) => {
				plugin.debug('incoming MCP tool invocation: ' + toolName);
				plugin.trace('incoming MCP tool payload for ' + toolName + ': ' + JSON.stringify(args, null, '\t'));
				let contributorPlugin = plugin.runtime.getPlugin(extenderId);
				let handlerFn = contributorPlugin[extensionConfig.handler];
				let params = args.params && typeof args.params === 'object' ? args.params : {};
					let query = args.query && typeof args.query === 'object' ? args.query : {};
					let body = {};
					if(args.body){
						if(typeof args.body === 'object'){
							body = args.body;
						}else if(typeof args.body === 'string'){
							try{ body = JSON.parse(args.body); }catch(e){ body = {}; }
						}
					}
				let fakeReq = { body, headers: httpReq ? httpReq.headers : {}, params, query };
				let fakeRes = {
						json: (obj) => resolve({
							content: [{ type: 'text', text: JSON.stringify(obj) }]
						}),
						download: (absoluteFilePath, filename) => {
							try {
								const ext = nodePath.extname(filename || absoluteFilePath).toLowerCase();
								const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
								const blob = fs.readFileSync(absoluteFilePath).toString('base64');
								const uri = 'workspace:///' + (filename || nodePath.basename(absoluteFilePath));
								resolve({
									content: [
										{ type: 'resource', resource: { uri, blob, mimeType } },
										{ type: 'text', text: blob }
									]
								});
							} catch(e) {
								resolve({
									content: [{ type: 'text', text: JSON.stringify({ status: 500, message: e.message }) }]
								});
							}
						},
						status: function(code) { this._code = code; return this; },
						set: function() { return this; }
					};
				handlerFn.call(contributorPlugin, fakeReq, fakeRes);
			});
		});
	};
};

plugin.lazzyPlug = function(extenderId, extensionConfig) {
	plugin.debug('->lazzyPlug(' + extenderId + ')');
	if (MCP_EXTENSION_POINT_ID === extensionConfig.point) {
		if (extensionConfig.apiId) {
			// API-descriptor based registration: find the handler extension by id in the contributor's manifest
			let contributorManifest = plugin.runtime.getPluginWrapper(extenderId).getConfig();
			let handlerExtension = contributorManifest.extends.find(function(e) { return e.id === extensionConfig.apiId; });
			if (handlerExtension && handlerExtension.apidoc) {
				let registrarFn = plugin.buildApiRegistrar(extenderId,handlerExtension);
				plugin.toolRegistrars.push(registrarFn);
				plugin.info('registered API-based tool registrar for apiId: ' + extensionConfig.apiId);
			} else {
				plugin.error('npa.mcp.core: no apidoc found for apiId "' + extensionConfig.apiId + '"');
			}
		} else if (extensionConfig.registrar) {
			// Legacy registrar-function based registration
			let contributorPlugin = plugin.runtime.getPlugin(extenderId);
			let registrarFn = contributorPlugin[extensionConfig.registrar];
			if (typeof registrarFn === 'function') {
				plugin.toolRegistrars.push(registrarFn.bind(contributorPlugin));
				plugin.info('registered tool registrar from ' + extenderId + ':' + extensionConfig.registrar);
			} else {
				plugin.error('npa.mcp.core: registrar function "' + extensionConfig.registrar + '" not found on plugin ' + extenderId);
			}
		} else {
			plugin.error('npa.mcp.core: npa.mcp.tool extension "' + extensionConfig.id + '" has neither apiId nor registrar');
		}
	}
	plugin.debug('<-lazzyPlug()');
};

plugin.mcpRequestHandler = async function(req, res) {
	plugin.debug('->mcpRequestHandler()');
	plugin.debug('mcpRequestHandler() - headers: '+JSON.stringify(req.headers));
	plugin.invocationCount++;
	plugin.concurrentClients++;
	if(plugin.concurrentClients > plugin.peakConcurrentClients){
		plugin.peakConcurrentClients = plugin.concurrentClients;
	}
	const mcpName = plugin.getConfigValue('mcp.name');
	const mcpVersion = plugin.getConfigValue('mcp.version');
	const server = new McpServer({ name: mcpName, version: mcpVersion });

	for (const register of plugin.toolRegistrars) {
		register(server, req);
	}

	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
	res.on('close', () => {
		plugin.concurrentClients--;
		transport.close();
	});

	await server.connect(transport);
	await transport.handleRequest(req, res, req.body);
	plugin.debug('<-mcpRequestHandler()');
};

plugin.mcpHealthHandler = function(_req, res) {
	plugin.debug('->mcpHealthHandler()');
	const mcpName = plugin.getConfigValue('mcp.name');
	res.json({ status: 'ok', server: mcpName });
	plugin.debug('<-mcpHealthHandler()');
};

module.exports = plugin;
