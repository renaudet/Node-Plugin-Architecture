/*
 * plugin.js - Documentation collector service for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const Plugin = require('../../core/plugin.js');

var plugin = new Plugin();
plugin.pages = [];

/*
 * lazzyPlug - collect documentation page contributions
 *
 * Expected extensionPointConfig fields:
 *   label       {string}  - page display title (required)
 *   category    {string}  - top-level category (required)
 *   subcategory {string}  - second-level grouping (optional)
 *   url         {string}  - URL of the documentation page (required)
 */
plugin.lazzyPlug = function(extenderId, extensionPointConfig) {
	if('npa.documentation.page' == extensionPointConfig.point) {
		this.info('registering documentation page "' + extensionPointConfig.label + '" from plugin ' + extenderId);
		this.pages.push({
			id:          extensionPointConfig.id,
			label:       extensionPointConfig.label,
			category:    extensionPointConfig.category,
			subcategory: extensionPointConfig.subcategory || null,
			url:         extensionPointConfig.url,
			plugin:      extenderId
		});
	}
}

/*
 * buildToc - assemble pages into a hierarchical TOC:
 * [ { category, subcategories: [ { label, pages: [ { id, label, url } ] } ] } ]
 */
plugin.buildToc = function() {
	let categoryMap = {};
	for(var i = 0; i < this.pages.length; i++) {
		let page = this.pages[i];
		if(typeof categoryMap[page.category] == 'undefined') {
			categoryMap[page.category] = {};
		}
		let subcatKey = page.subcategory || '';
		if(typeof categoryMap[page.category][subcatKey] == 'undefined') {
			categoryMap[page.category][subcatKey] = [];
		}
		categoryMap[page.category][subcatKey].push({
			id:    page.id,
			label: page.label,
			url:   page.url
		});
	}
	let toc = [];
	let categories = Object.keys(categoryMap).sort();
	for(var c = 0; c < categories.length; c++) {
		let catName = categories[c];
		let subcatMap = categoryMap[catName];
		let subcategories = [];
		let subcatKeys = Object.keys(subcatMap).sort();
		for(var s = 0; s < subcatKeys.length; s++) {
			let subcatLabel = subcatKeys[s];
			subcategories.push({
				label: subcatLabel,
				pages: subcatMap[subcatLabel]
			});
		}
		toc.push({
			category:      catName,
			subcategories: subcategories
		});
	}
	return toc;
}

module.exports = plugin;
