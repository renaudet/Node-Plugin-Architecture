# Node-Plugin-Architecture
A Plugin-based architecture for Node.js applications

This project is a proof-of-concept for an Eclipse-like Plug-in architecture for applications written in Node.js.
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

plugin.initialize = function(){  
	var httpListener = this.runtime.getPlugin('npa.http');  
	httpListener.startListener();  
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

## Writing a plugin for NPA
    
The plugin itself is a pure node.js module, with its usual require statements and export declaration.

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

Create a new directory to store your own plugins
Update the `appConfig.json` file to add a new `site`:

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

And that's it. Though you may find it hard to refer to the base NPA modules as-is (un-resolved module location at runtime) while using the base Plugin class:

```javascript
const Plugin = require('/core/plugin.js'); //-> Exception
```

You may use the absolute path for the /core/plugin.js module, but a more elegant way to solve this is as follow:

```javascript
const Plugin = require(process.cwd()+'/core/plugin.js');
```

Using  _process.cwd()_  is not entirely safe but the integration runtime itself does not change the working directory.

## Base Plugins documentation

### NPA Core / npa.core

This is the root plugin for the NPA plugin-tree architecture. It provides two extension points:

#### npa.core.application

Extensions for this extension point should provide a `name` in the extension declaration:

```json
{
	"point": "npa.core.application",
	"id": "npa.ui.test.application.application",
	"name": "test"
}
```

The plugin itself should provide an `initialize()`  method without arguments. The method will be called by the launcher if the `--application <name>` launcher's argument matches this extension's name

Several  _application_  can be contributed at the same time, but only one will be initialized

#### npa.core.service

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

This way, the service consumer is independant from the service provider. It doesn't require to know anything about the **Express** stuff used for its implementation

### npa.http

This is the HTTP provider for NPA. Based on **Express**, it provides exension points to easily plug routers, handlers or static content.

Extension points:

#### npa.http.router

Extensions for this extension point should provide a `path` in their declaration:

```json
{
	"point": "npa.http.router",
	"id": "npa.ui.test.application.router",
	"path": "/test"
} 
```
	
Contributed **handlers** may refer to a specific router by using its id (see example below)

#### npa.http.handler

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

#### npa.http.static

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

#### npa.http.home

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

A basic logging facility for NPA. Notice that the **Plugin** base Class provides convenience `info()`, `debug()`, `trace()` and `error()` methods, but by default, these methods will redirect to the standard console.

Extending `npa.logging` will redirect the logs to a `plugin.out.log` or `plugin.err.log` file depending on the situation. The relative location of these file within the main logs directory is precised through the extension declaration.

Extension point:

#### npa.log.provider

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