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
const MCP_EXTENSION_POINT_ID = 'npa.mcp.tool';

var plugin = new Plugin();

// Registry of tool registrar functions contributed via npa.mcp.tool extension point
plugin.toolRegistrars = [];

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
	// Extract the first path + post operation from the OpenAPI descriptor
	let path = Object.keys(apidoc.paths)[0];
	let operation = apidoc.paths[path].post;
	let toolName = operation.operationId;
	let toolDescription = operation.description || operation.summary;
	let schema = operation.requestBody.content['application/json'].schema;
	let zodShape = plugin.buildZodSchema(schema.properties, schema.required);

	plugin.debug('<-buildApiRegistrar()');
	return function(server, httpReq) {
	       server.tool(toolName, toolDescription, zodShape, async (args) => {
	           return new Promise((resolve) => {
	               // Récupérer le plugin contributeur via le runtime
	               let contributorPlugin = plugin.runtime.getPlugin(extenderId);
	               let handlerFn = contributorPlugin[extensionConfig.handler];
	               
	               // Construire des objets req/res simulés (duck-typed)
	               // Les headers HTTP de la requête MCP originale sont propagés
	               // pour permettre la vérification de sécurité (x-api-key, Authorization...)
	               let fakeReq = { body: args, headers: httpReq ? httpReq.headers : {}, query: {} };
	               let fakeRes = {
	                   json: (obj) => resolve({
	                       content: [{ type: 'text', text: JSON.stringify(obj) }]
	                   }),
	                   status: function(code) { this._code = code; return this; }
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
	const mcpName = plugin.getConfigValue('mcp.name');
	const mcpVersion = plugin.getConfigValue('mcp.version');
	const server = new McpServer({ name: mcpName, version: mcpVersion });

	for (const register of plugin.toolRegistrars) {
		register(server, req);
	}

	const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
	res.on('close', () => transport.close());

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
