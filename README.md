# Node-Plugin-Architecture
A Plugin-based architecture for Node.js applications

This project is a proof-of-concept for an Eclipse-like Plug-in-like architecture for applications written in Node.js.
It does not supercedes the modular approach of Node, but instead offers a framework to create applications using a collaborative way, which Node hardly achieves using callbacks.

A simple example is worth a thousand explanation...

## Introduction / Sample

Let's say I want to create a first application using Node.js and express. I would write some code like the following:

```javascript
const express = require('express');  
  
var app = express();  
  
app.get('/sayHello', function (req, res) {  
    res.set('Content-Type','application/json');  
    res.json({"message": "Hello, World!","from": "myApp_1"});  
});  
  
app.listen(9080);
```

Now, if I want to create a second, slightly different application but using the same dependencies, I would write some code like the following:

```javascript
const express = require('express');  
  
var app = express();  
  
app.get('/sayHello', function (req, res) {  
	res.set('Content-Type','application/json');  
	if(req.query.to){  
		var helloStr = 'Hello, Mr. '+req.query.to;  
		res.json({"message": helloStr,"from": "myApp_2"}});  
	}else{  
		res.json({"message": "Hello, World!","from": "myApp_2"}});  
	}  
});  
  
app.listen(9090);
```

The real contribution for both these applications is the implementation of the callback associated with the `express.get()` method call.

With the Eclipse-like Plug-in architecture, I could have written these applications by adding a plugin to the base framework that contribute to a specific extension point. 
The plugin itself is a basic Node.js module providing a sub-class of the base Plugin class. The sub-class is responsible for implementing the callback.  
  
The plugin plugs itself to the framework using a manifest file written in JSON.

##### manifest.json:

```json
{  
  "id": "sayHello",  
  "name": "Say Hello Application",  
  "version": "1.0.0",  
  "plugin": "plugin.js",  
  "requires": [  
  	{"type": "plugin","id": "root","version": "1.0.0"},  
  	{"type": "plugin","id": "npa.http","version": "1.0.0"}  
  ],  
  "extends": [  
  	{  
  		"point": "npa.application",  
  		"id": "sayHello.application",  
  		"name": "sayHello"  
  	},  
  	{  
  		"point": "npa.http.router",  
  		"id": "sayHello.application.router",  
  		"path": "/myApp"  
  	},  
  	{  
  		"point": "npa.http.handler",  
  		"id": "sayHello.application.hello.handler",  
  		"router": "sayHello.application.router",  
  		"method": "GET",  
  		"schema": "/sayHello",  
  		"handler": "sayHelloRequestHandler"  
  	}  
  ],  
  "provides": [  
  ]  
}
```
  
##### plugin.js:

```javascript
const Plugin = require('../../core/plugin.js');  
var plugin = new Plugin();  

plugin.start = function(){  
	let httpServer = this.getService('http');  
	httpServer.startListener();  
}  

plugin.sayHelloRequestHandler = function(req,res){  
	res.set('Content-Type','application/json');  
	res.json({"message": "Hello, World!","from": "sayHello plugin"}});  
}  

module.exports = plugin;
```
 
At first glance, this seems to be way more complicated than our very first code example. But take a closer look: this code is now independent from **express**!

Also, the mapping between the callback and the URL schema is now externalized in the manifest file, so that it may be changed without modifying the code.  

##### Plugin installation  

The plugin itself is a subdirectory within the plugin main directory specified in an install site location defined in the appConfig.json file.

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		},
		{
			"id": "myApp",
			"location": "./myAppPlugins"
		}
	]
}
```

In the above example, there are two of them: default and myApp. Our sayHello application is delivered as a plugin from the myApp installation site.

The runtime will dynamically discover all the plugins and resolve the
dependencies so that all required plugins are initialized before the one explicitly requiring them. In case two plugins with same id exist within the installation, the one with the higher version gets loaded.  

To run the application, we use the app.js launcher using a command-line like:  

    $> node app.js --port 9080 --application sayHello

##### Site configuration

We may want to launch the NPA plugin framework with different set of plugin contributions.

For example, a test instance may want to use a plugin contributing an SQL database support using SQLite whereas a production instance may want to use a plugin offering support for MySQL.

To do so, you don't have to edit the appConfig.json file each time, which would be bothersome and error-prone. Instead, use the installation command-line argument to specify a dedicated appConfig.json file for the launch configuration:  

    $> node app.js --installation ./configs/testConfiguration.json --port 9080 --application myDBApplication
    
or:  

    $> node app.js --installation ./configs/productionConfiguration.json --application myDBApplication
    
## Installation

NPA is a full Node.js-based application. Once the package is installed/unzipped and configured (see Install locations), go to the root directory containing the package.json file and type:

```bash
$>npm install 
```

This will install the required Node.js modules. Notice that plugins from external install locations will use the **NODE_PATH** environment variable to retrieve their dependencies.

To start the default application and check everything is working, open a command prompt on the root directory and type:

```bash
$>export NODE_PATH=./node_modules
$>node app.js --application test --logs ./logs --level finest --port 9080 --name "APAF Test Server"
```

Open a browser on the following URL: http://localhost:9080

## Writing a plugin for NPA
    
A plugin is a pure node.js module, with its usual require statements and export declaration.

The NPA framework contributes a base class for plugins, but a factory service may provide an alternate way for creating the plugin instance.

```javascript
const Plugin = require('../../core/plugin.js');  
var plugin = new Plugin();
```
  
The Node module exports this unique instance. The purpose of the module is to customize the instance, that is, to provide callbacks, request handlers and other business functions.

```javascript
module.exports = plugin;
```

When the plugin extends another plugin's extension point, it may provide configuration (JSON) or code contribution. In this later case
the plugin is expected to follow the interface requirement for the extension point provider.

```javascript
plugin.helloRequestHandler = function(req,res){
	[...]
}
```

In our code sample, the  _helloRequestHandler_  prototype follows the rules set by the  _npa.http.handler_  extension point defined by the  _npa.http_  plugin, which itself follow the rules set by the  `request`  framework. 

## Packaging a plugin

An NPA plugin is basically one or more Node.js module files gathered in a directory with a  _manifest.json_  file to describe its content.

By convention, the main plugin file should be named `plugin.js` but it's not an obligation.

The plugin manifest file is a JSON file with name `manifest.json` having the following syntax:

```json
{
  "id": "<this plugin's unique ID - use a namespace to ensure uniqueness as org-type.org-name.project-name.package-name>",
  "name": "<the common name for this plugin - will be used in the integration runtime messages>",
  "version": "x.y.z",
  "plugin": "plugin.js",
  "requires": [
  	{"type": "plugin","id": "<this plugin's explicit dependency ID>","version": "x.y.z"}
  ],
  "extends": [
  	{
  		"point": "<an extension point's ID>",
  		"id": "<this extension ID - should be unique>",
  		"<some-field>": "<some-value>"
  	}
  ],
  "provides": [
  	{"id": "<an extension point's unique ID provided by this plugin - may be extended by self or others>"}
  ]
}
```

The cardinality for the `extends` array is [0..n] and the cardinality for the `provides` array is [0..n].

The cardinality for the `requires` array is [0..n] but it would be rather uncommon for a plugin to not at least depend on the `npa.logging` plugin.

By convention, the plugin's directory name should be `<plugin-id>_<plugin-version>`. The directory itself is a sub-directory for an NPA  _install location_ 


## NPA Install Location

NPA provides a base plugin set installed by default in the `./plugins` directory. This location is configured in the `appConfig.json` file:

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		}
	]
}
```

Users may add their own plugins in this directory where they will be automatically discovered, but the recommended strategy is to create a new  _install location_  :

Create a new directory to store your own plugins and update the `appConfig.json` file to add a new `site`:

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		},
		{
			"id": "<an ID for your install location - will be used later for automatic updates>",
			"location": "<relative or absolute Path to your own plugins directory>"
		}
	]
}
```

Notice that you can also create your own specific version of the appConfig.json file and point to this file in your launch configuration:   

    $> node app.js --installation ./configs/myConfiguration.json --application myApplication

And that's it. Though you may find it hard to refer to the base NPA modules as-is (un-resolved module location at runtime) while using the base Plugin class:

```javascript
const Plugin = require('/core/plugin.js'); //-> Exception
```

You may use the absolute path for the /core/plugin.js module, but a more elegant way to solve this is as follow:

```javascript
const ENV_NPA_INSTALL_DIR = 'NPA_INSTALL_DIR';
const Plugin = require(process.env[ENV_NPA_INSTALL_DIR]+'/core/plugin.js');
```

Indeed, the NPA application launcher sets the  _NPA_INSTALL_DIR_  environment variable to its own install location, which makes it easier to resolve relative paths in downstream plugins.

## Base Plugins documentation

### npa.core

Dependency:

```json
	{"type": "plugin","id": "npa.core","version": "1.0.0"}
```

This is the root plugin for the NPA plugin-tree architecture. It provides two extension points:

#### *npa.core.application

Extensions for this extension point should provide a `name` in the extension declaration:

```json
{
	"point": "npa.core.application",
	"id": "npa.ui.test.application.application",
	"name": "test"
}
```

The plugin itself should override the `start()`  method without arguments. The method will be called by the launcher if the `--application <name>` launcher's argument matches this extension's name

Several  _application_  can be contributed at the same time, but only one will be started by the launcher (default value: test)

#### *npa.core.service

Extensions for this extension point should provide a `service` ID in the extension declaration:

```json
{
	"point": "npa.core.service",
	"id": "npa.http.service",
	"service": "http"
}
```
  	
At runtime, any plugin will be able to use this service interface by calling the Core's  _getService()_  method:

```javascript
let core = this.runtime.getPlugin('npa.core');
let httpService = core.getService('http');
```

This way, the service consumer is independant from the service provider. It doesn't require to know anything about the **Express** stuff used for the implementation of the  _http_  service in our example.

A convenience method is implemented in the base Plugin class to get the same result:

```javascript
let httpService = this.getService('http');
```

Several plugins may provide an implementation for the same service, though, it is up to the runtime to choose which one will be effectively called.

### npa.http

Dependency:

```json
	{"type": "plugin","id": "npa.http","version": "1.0.0"}
```

This is the HTTP provider for NPA. Based on **Express**, it provides exension points to easily plug routers, handlers or static content.

Extension points:

#### *npa.http.router

Extensions for this extension point should provide a `path` in their declaration:

```json
{
	"point": "npa.http.router",
	"id": "npa.ui.test.application.router",
	"path": "/test"
} 
```
	
Contributed **handlers** may refer to a specific router by using its id (see example below)

#### *npa.http.handler

Callback handlers are externally configured through the `manifest.json`  file:

```json
{
	"point": "npa.http.handler",
	"id": "npa.ui.test.application.query.record.handler",
	"router": "npa.ui.test.application.router",
	"method": "POST",
	"schema": "/getRecords",
	"handler": "getRecordsHandler"
}
```
	
In this example, the  _npa.ui.test.application.query.record.handler_  handler contributes a POST callback named  _getRecordsHandler(req,res)_  to the router  _npa.ui.test.application.router_ . 

As the router provided the `/test` path, this handler will be associated with the `/test/getRecords` uri

#### *npa.http.static

Extensions for this extension point should provide a `path` and a `localDir`  in their declaration:

```json
{
	"point": "npa.http.static",
	"id": "npa.ui.test.application.htdocs",
	"path": "/static",
	"localDir": "htdocs"
}
```

**Express** will associate the static content located in this local directory with the provided `path` prefix.

The local directory is a subdirectory from the contributon plugin's own directory. Its name is **not** used in the resulting URIs.

For example, a file  _myGifFile.gif_  located in the  _img_  subdirectory of the  _htdocs_  directory configured above would be refered to as `/static/img/myGifFile.gif`

#### *npa.http.home

To redirect the unspecified uri '/' to a given uri, a plugin may provide an extension to `npa.http.home`

```json
{
	"point": "npa.http.home",
	"id": "npa.ui.test.application.home",
	"uri": "/static/home.html"
}
```

This is not the same mechanism as a  _default page_  but it is usefull to redirect a default request to an application Home page (like index.html)

### npa.logging

Dependency:

```json
	{"type": "plugin","id": "npa.logging","version": "1.0.0"}
```

A basic logging facility for NPA. Notice that the **Plugin** base Class provides convenience `info()`, `debug()`, `trace()` and `error()` methods, but by default, these methods will redirect to the standard console.

Extending `npa.logging` will redirect the logs to a `plugin.out.log` or `plugin.err.log` file depending on the situation. The relative location of these file within the main logs directory is precised through the extension declaration.

Extension point:

#### *npa.log.provider

Extensions for this extension point should provide a `dir` location  in their declaration:

```json
{
	"point": "npa.log.provider",
	"id": "npa.http.logger",
	"dir": "http"
}
```
 	  
The main directory for logs is by default relative to the directory containing the NPA's `app.js` file and is named `logs`.
Applications can change this default location by using the `--logs` command-line parameter.

By default, applications are using the `info` logging level. To change to a more precisely defined logging mode, use the `--level` command-line parameter.
Accepted modes are `info`, `error`, `debug` and `trace`

### npa.couchdb.adapter

Dependency:

```json
	{"type": "plugin","id": "npa.couchdb.adapter","version": "1.0.0"}
```

A basic adapter for the no-SQL Apache CouchDB backend.

Service:

The adapter provides a `'couchdb'` service that support registered Datasources from the `'npa.couchdb.adapter.datasource'` extension point.
The service interface provides the following methods:

```javascript
createDatabase = function(reference,callback);
query = function(reference,query,callback);
findByPrimaryKey = function(reference,data,callback);
createRecord = function(reference,data,callback);
updateRecord = function(reference,data,callback);
deleteRecord = function(reference,data,callback);
```

Extension point:

#### *npa.couchdb.adapter.datasource

Extensions for this extension point should provide the following declaration:

```json
{
	"point": "npa.couchdb.adapter.datasource",
	"id": "<extension ID>",
	"reference": "<a simple datasource reference>",
	"hostname": "localhost",
	"port": "<the Apache CouchDB database port - optional, defaults to 5984>",
	"dbname": "<the Apache CouchDB database name>",
	"username": "<the Apache CouchDB database user's username - optional>",
	"password": "<the Apache CouchDB database user's password - optional>",
	"maxPageSize": 500,
	"environment": {
		"hostname": "<an environment variable name that take precedence over the hostname attribute - for container deployment>",
  		"port": "<an environment variable name that take precedence over the port attribute - for container deployment>",
  		"username": "<an environment variable name that take precedence over the username attribute - for container deployment>",
  		"password": "<an environment variable name that take precedence over the password attribute - for container deployment>"
	}
}
```
This registers a Datasource whithin the CouchDB adapter that can be refered to by its `reference` later on.

Example:

```javascript
const myDsRef = 'myDatasource'; //previously declared using the npa.couchdb.adapter.datasource extension point

plugin.doSomething = function(){
	let couchService = this.getService(couchdb);
	couchService.query(myDsRef,{},function(err,records){
		if(err){
			plugin.error(JSON.stringify(err));
		}else{
			//do something with the records
		}
	});
}
```

### npa.crypto

Dependency:

```json
	{"type": "plugin","id": "npa.crypto","version": "1.0.0"}
```

A cryptographic facility for NPA using an SHA256 cipher suite.

Service:

The npa.crypto plugin provides a `cryptography` service with the following interface:

```javascript
encrypt = function(data);
decrypt = function(encryptedData);
```

It is usefull to encrypt data in a file or in a JSON document before it is stored into the CouchDB database

### npa.mail

Dependency:

```json
	{"type": "plugin","id": "npa.mail","version": "1.0.0"}
```

A basic `mail` service provider

Service:

The npa.mail plugin provides a `mail` service with the following interface:

```javascript
sendMail = function(providerId,from,to,subject,content,isHtml,then);
```

The `providerId` refers to a previously registered mail provider using the npa.mail's `npa.mail.provider` extension point

extension point:

#### *npa.mail.provider

Extension for this extension point should provide the following declaration:

```json
{
	"point": "npa.mail.provider",
	"id": "<the extension ID>",
	"type": "SMTP",
	"host": "<mail provider's host>",
	"port": <mail provider's port>,
	"secure": <true/false>,
	"username": "<mailbox's username>",
	"password": "<mailbox's password>"
} 
```

Example:

```javascript
const MAIL_PROVIDER = 'SMTP'; //previously declared using the npa.mail.provider extension point

plugin.doSomething = function(ctx){
	let mailService = this.getService('mail');
	mailService.sendMail(MAIL_PROVIDER,ctx.from,ctx.to,ctx.subject,ctx.content,true,function(err,response){
		if(err){
			plugin.error(JSON.stringify(err));
		}else{
			//do something with the response
		}
	});
}
```

### npa.rest

This plugin provides a basic REST client

Interface:

```javascript
performRestApiCall = function(restContext,callback);
```

The restContext is a JSON object providing the following attributes:

```json
{
	"host": "<target host>",
	"port": <target port as an integer>,
	"uri": "<requested REST call URI>",
	"secured": <true/false>,
	"username": "<optional username for BASIC authentication>",
	"password": "<optional password for BASIC authentication - mandatory if username is present>",
	"method": "<the HTTP method, one of GET/PUT/POST/DELETE>",
	"payload": "<optional JSON payload - defaults to {} - ignored for GET/DELETE request types>"
}
```

Example:

```javascript
const REST_CLIENT_PLUGIN_ID = 'npa.rest';

plugin.doSomething = function(ctx){
	let restClient = this.runtime.getPlugin(REST_CLIENT_PLUGIN_ID);
	let ctx = {
		"host": "127.0.0.1",
		"port": 9080,
		"uri": "/servlet/MyServlet?param=1234",
		"method": "GET"
	}
	restClient.performRestApiCall(ctx,function(err,response){
		if(err){
			plugin.error(JSON.stringify(err));
		}else{
			//do something with the response
		}
	});
}
```

### npa.system.call

This plugin provides a convenient, asynchronous way to execute System calls and monitor the child's process status to access the standard console output.

```javascript
executeCommand = function(command,detachProcess,onCommandExecutionLaunched,onChildProcessCompleted);
```

Example:

```javascript
const SYSTEM_CALL_PLUGIN_ID = 'npa.system.call';
let processId = 0;

plugin.doSomething = function(){
	let system = this.runtime.getPlugin(SYSTEM_CALL_PLUGIN_ID);
	
	system.executeCommand('ps -ef',false,function(err,pid){
		if(err){
			plugin.error(JSON.stringify(err));
		}else{
			processId = pid;
		}
	},function(){
		let process = system.process[processId];
		plugin.info('exit code: '+process.exitCode);
		for(var i=0;i<process.output.length;i++){
			plugin.info((i+1)+': '+process.output[i]);
		}
	});
}
```

### npa.web.stack

This plugin provides a basic web stack for responsive Web applications. The static resources provided are registered with the default path '/'

Included:

```
bootstrap v5.3.0-alpha1
jquery v3.6.3
moment v2.29.4
CodeMirror v5.44.0
MD5 by CryptoJS v3.1.2
```

### npa.workspace

This plugin provides basic local filesystem access for applications. The hierarchy starts with a concept of a Project, then folders and files.
A Project contains an hidden `.project` file that contains metadata such as the creating date, the owner or the display name if different from the project's own directory name.

Other plugins can use the facility through a service.

Service:

The npa.workspace plugin provides a `workspace` service with the following interface:

```javascript
createProject = function(projectInfo);
getProject = function(name);
deleteProject = function(name,user);
getProjects = function(filter);
createFolder = function(project,relativPath);
deleteResource = function(path);
createLocalFile = function(relativeFileName,project,content,options={});
setFileContent = function(workspaceRelativeFileName,content,options={});
appendToFileContent = function(workspaceRelativeFileName,content,options={});
getFileContent = function(filePath,options={});
absolutePath = function(resourcePath);
renameFile = function(baseDir,oldName,newName);
```

### npa.jobs

This plugin provides a basic long-running job management API that enables monitoring and feedback from a UI.

Other plugins can use the job API through a service.

Service:

The npa.jobs plugin provides a `jobs` service with the following interface:

```javascript
getJobs = function();
getJob = function(jobId);
createJob = function(owner,description);
updateJob = function(job);
```

### npa.runtime.props

This plugin provides a server-side runtime properties management facility. This is a non-persistent, in-memory runtime properties facility management only.

Other plugins can use the runtime properties API through a service.

extension point:

#### *npa.runtime.property.provider

Extension for this extension point should provide the following declaration:

```json
{
	"point": "npa.runtime.property.provider",
	"id": "<the extension ID>"
	"name": "<the property name>",
	"description": "<a property description for the UI>",
	"type": "string/int/boolean/percentage",
	"value": <default value depending on the type>,
	"locked": true/false
} 
```

Service:

The npa.runtime.props plugin provides a `properties` service with the following interface:

```javascript
newProperty = function(property);
getProperties = function();
getProperty = function(propertyName);
setProperty = function(propertyName,value);
lockProperty = function(propertyName);
```
Notice that the property may be declared locked or may be locked at plugin configuration time so that it is read-only for other downstream plugins

### npa.core.admin

This plugin is deprecated
