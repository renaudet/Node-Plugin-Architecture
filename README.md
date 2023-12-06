# Node-Plugin-Architecture
A Plugin-based architecture for Node.js applications

This project is a proof-of-concept for an Eclipse-like Plug-in architecture for applications written in Node.js.
It does not supercedes the modular approach of Node, but instead offers a framework to create applications using a collaborative way, which Node hardly achieves using callbacks.

A simple example is worth a thousand explanation...

## Introduction / Sample

Let's say I want to create a first application using Node.js and express. I would write some code like the following:

    const express = require('express');  
      
    var app = express();  
      
    app.get('/sayHello', function (req, res) {  
        res.set('Content-Type','application/json');  
        res.json({"message": "Hello, World!","from": "myApp_1"});  
    });  
      
    app.listen(9080);  

Now, if I want to create a second, slightly different application but using the same dependencies, I would write some code like the following:

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

The real contribution for both these applications is the implementation of the callback associated with the `express.get()` method call.

With the Eclipse-like Plug-in architecture, I could have written these applications by adding a plugin to the base framework that contribute to a specific extension point. 
The plugin itself is a basic Node.js module providing a sub-class of the base Plugin class. The sub-class is responsible for implementing the callback.  
  
The plugin plugs itself to the framework using a manifest file written in JSON.

##### manifest.json:

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

##### plugin.js:

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

##Writing a plugin for NPA
    
The plugin itself is a pure node.js module, with its usual require statements and export declaration.

The NPA framework contributes a base class for plugins, but a factory service my provide an alternative way for creating the plugin instance.

	const Plugin = require('../../core/plugin.js');  
	var plugin = new Plugin();
  
The Node module exports this unique instance. The purpose of the module is to customize the instance, that is, to provide callbacks, request handlers and other business functions.

	module.exports = plugin;

When the plugin extends another plugin's extension point, it may provide configuration (JSON) or code contribution. In this later case
the plugin is expected to follow the interface requirement for the extension point provider.

	plugin.helloRequestHandler = function(req,res){
		[...]
	}

In our code sample, the  _helloRequestHandler_  prototype follows the rules set by the  _npa.http.handler_  extension point defined by the  _npa.http_  plugin, which itself follow the rules set by the  `request`  framework. 
    