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
const MCP_EXTENSION_POINT_ID = 'npa.mcp.tool';

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
		} else if (def.type === 'boolean') {
			field = z.boolean();
		} else if (def.type === 'integer' || def.type === 'number') {
			field = z.number();
		} else if (def.type === 'array') {
			field = z.array(z.any());
		} else if (def.type === 'object') {
			field = z.record(z.string(), z.any());
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
	// Extract the first path + operation from the OpenAPI descriptor
	let path = Object.keys(apidoc.paths)[0];
	let pathDef = apidoc.paths[path];
	let method = Object.keys(pathDef)[0]; // post, get, put, delete...
	let operation = pathDef[method];
	let toolName = operation.operationId;
	let toolDescription = operation.description || operation.summary;
	// Build zodShape from both path/query parameters AND requestBody (merged)
	let props = {};
	let required = [];
	if (operation.parameters) {
		for (let param of operation.parameters) {
			props[param.name] = param.schema || { type: 'string' };
			if (param.description) props[param.name].description = param.description;
			if (param.required) required.push(param.name);
		}
	}
	if (operation.requestBody) {
		let schema = operation.requestBody.content['application/json'].schema;
		Object.assign(props, schema.properties || {});
		if (schema.required) required = required.concat(schema.required);
	}
	let zodShape = plugin.buildZodSchema(props, required);

	// Pre-compute which parameter names go to params/query vs body
	let pathParamNames = new Set();
	let queryParamNames = new Set();
	if (operation.parameters) {
		for (let param of operation.parameters) {
			if (param.in === 'path') pathParamNames.add(param.name);
			else if (param.in === 'query') queryParamNames.add(param.name);
		}
	}

	plugin.debug('<-buildApiRegistrar()');
	return function(server, httpReq) {
		server.tool(toolName, toolDescription, zodShape, async (args) => {
			return new Promise((resolve) => {
				// Récupérer le plugin contributeur via le runtime
				let contributorPlugin = plugin.runtime.getPlugin(extenderId);
				let handlerFn = contributorPlugin[extensionConfig.handler];

				// Dissocier les arguments selon leur rôle déclaré dans l'apidoc :
				// - path params  → req.params
				// - query params → req.query
				// - le reste     → req.body
				// Cas spécial : si le body contient un unique champ "data" de type objet,
				// on l'étale directement comme req.body pour les handlers à body dynamique.
				// Les headers HTTP de la requête MCP originale sont propagés
				// pour permettre la vérification de sécurité (x-api-key, Authorization...)
				let params = {};
				let query = {};
				let body = {};
				for (let [key, value] of Object.entries(args)) {
					if (pathParamNames.has(key)) params[key] = value;
					else if (queryParamNames.has(key)) query[key] = value;
					else body[key] = value;
				}
				if (Object.keys(body).length === 1 && typeof body.data === 'object' && body.data !== null) {
					body = body.data;
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
