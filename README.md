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

In the above example, there are two of them: default and myApp. Our sayHello application is delivered as a plugin from the myApp installation site.

The runtime will dynamically discover all the plugins and resolve the
dependencies so that all required plugins are initialized before the one explicitly requiring them. In case two plugins with same id exist within the installation, the one with the higher version gets loaded.  

To run the application, we use the app.js launcher using a command-line like:  

    $> node app.js --port 9080 --application sayHello

## Writing a plugin for NPA
    
The plugin itself is a pure node.js module, with its usual require statements and export declaration.

The NPA framework contributes a base class for plugins, but a factory service my provide an alternative way for creating the plugin instance.

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

## Base Plugins documentation

### NPA Core / npa.core

This is the root plugin for the NPA plugin-tree architecture. It provides two extension points:

#### npa.core.application

Extensions for this extension point should provide a `name` in the extension declaration:

	{
		"point": "npa.core.application",
		"id": "npa.ui.test.application.application",
		"name": "test"
	}

The plugin itself should provide an `initialize()`  method without arguments. The method will be called by the launcher if the `--application <name>` launcher's argument matches this extension's name

Several  _application_  can be contributed at the same time, but only one will be initialized

#### npa.core.service

Extensions for this extension point should provide a `service` ID in the extension declaration:

	{
		"point": "npa.core.service",
		"id": "npa.http.service",
		"service": "http"
	}
  	
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

	{
		"point": "npa.http.router",
		"id": "npa.ui.test.application.router",
		"path": "/test"
	} 
	
Contributed **handlers** may refer to a specific router by using its id (see example below)

#### npa.http.handler

Callback handlers are externally configured through the `manifest.json`  file:

	{
		"point": "npa.http.handler",
		"id": "npa.ui.test.application.query.record.handler",
		"router": "npa.ui.test.application.router",
		"method": "POST",
		"schema": "/getRecords",
		"handler": "getRecordsHandler"
	}
	
In this example, the  _npa.ui.test.application.query.record.handler_  handler contributes a POST callback named  _getRecordsHandler(req,res)_  to the router  _npa.ui.test.application.router_ . 

As the router provided the `/test` path, this handler will be associated with the `/test/getRecords` uri

#### npa.http.static

Extensions for this extension point should provide a `path` and a `localDir`  in their declaration:

	{
		"point": "npa.http.static",
		"id": "npa.ui.test.application.htdocs",
		"path": "/static",
		"localDir": "htdocs"
	}

**Express** will associate the static content located in this local directory with the provided `path` prefix.

The local directory is a subdirectory from the contributon plugin's own directory. Its name is **not** used in the resulting URIs.

For example, a file  _myGifFile.gif_  located in the  _img_  subdirectory of the  _htdocs_  directory configured above would be refered to as `/static/img/myGifFile.gif`

#### npa.http.home

To redirect the unspecified uri '/' to a given uri, a plugin may provide an extension to `npa.http.home`

	{
		"point": "npa.http.home",
		"id": "npa.ui.test.application.home",
		"uri": "/static/home.html"
	}

This is not the same mechanism as a  _default page_  but it is usefull to redirect a default request to an application Home page (like index.html)
  	  
