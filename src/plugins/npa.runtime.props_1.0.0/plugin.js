/*
 * plugin.js - Runtime Properties management plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const moment = require('moment');
const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';

var plugin = new Plugin();
/*
Property structure: {
    "id": "<contribution ID>",
    "point": "npa.runtime.property.provider",
    "name": "<property name>",
    "type": "<property type, one of string/int/boolean/moment/percentage>",
    "value": <according to type>,
    "locked": true/false <if true, property cannot be updated>
}
*/
plugin.properties = {};

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
    this.trace('->lazzyPlug('+extenderId+','+extensionPointConfig.point+')');
    if('npa.runtime.property.provider'==extensionPointConfig.point){
        this.debug('contribution: '+JSON.stringify(extensionPointConfig));
        this.newProperty(extensionPointConfig);
    }
    this.trace('<-lazzyPlug()');
}

plugin.newProperty = function(property){
    this.trace('->newProperty()');
    if(property && property.name){
        let propStruct = this.properties[property.name];
        if(typeof propStruct=='undefined'){
            propStruct = Object.assign({},property);
            propStruct.set = moment();
            delete propStruct.point;
            delete propStruct.id;
            this.properties[propStruct.name] = propStruct;
            this.trace('<-newProperty()');
            return propStruct;
        }else{
            this.trace('<-newProperty()');
            return null;
        }
    }
    this.trace('<-newProperty() invalid');
    return null;
}

plugin.getProperties = function(){
    this.trace('->getProperties()');
    let props = [];
    for(var id in this.properties){
        let prop = this.properties[id];
        props.push(prop);
    }
    this.trace('<-getProperties()');
    return props;
}

plugin.getProperty = function(propertyName){
    this.trace('->getProperty('+propertyName+')');
    let propStruct = this.properties[propertyName];
    if(typeof propStruct!='undefined'){
        this.trace('<-getProperty()');
        return propStruct.value;
    }else{
        this.trace('<-getProperty()');
        return undefined;
    }
}

plugin.setProperty = function(propertyName,value){
    this.trace('->setProperty('+propertyName+')');
    let propStruct = this.properties[propertyName];
    if(typeof propStruct!='undefined'){
        if(!propStruct.locked){
            this.debug('new value: '+value);
            propStruct.value = value;
            propStruct.set = moment();
        }
        this.trace('<-setProperty()');
        return propStruct.value;
    }else{
        this.trace('<-setProperty()');
        return undefined;
    }
}

plugin.lockProperty = function(propertyName){
    this.trace('->lockProperty('+propertyName+')');
    let propStruct = this.properties[propertyName];
    if(typeof propStruct!='undefined'){
        if(!propStruct.locked){
            propStruct.set = moment();
            propStruct.locked = true;
        }
        this.trace('<-lockProperty()');
    }else{
        this.trace('<-lockProperty()');
    }
}

module.exports = plugin;