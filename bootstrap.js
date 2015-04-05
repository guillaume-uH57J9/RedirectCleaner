"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function startup(data, reason) {
	
	var prefs = Services.prefs.getDefaultBranch("extensions.redirectcleaner.");
	prefs.setCharPref("mode", "whitelist");
	prefs.setCharPref("whitelist", "");
	prefs.setCharPref("blacklist", "");
	prefs.setBoolPref("regexp", false);
	prefs.setBoolPref("highlight", true);
	RedirectCleaner.prefs();
	
	if(Services.appinfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}") {
		
		/* Firefox */
		
		Cu.import("resource:///modules/CustomizableUI.jsm");
		CustomizableUI.createWidget({
			
			type: "custom",
			id : "redirectcleaner-toolbarbutton",
			defaultArea: CustomizableUI.AREA_NAVBAR,
			onBuild: function(document) {
				
				var toolbarbutton = Widget.create(document);
				return toolbarbutton;
				
			}
			
		});
		
	}
	
	if(Services.appinfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}") {
		
		/* SeaMonkey */
		
		var windows = Services.wm.getEnumerator("navigator:browser");
		while(windows.hasMoreElements()) {
			
			var window = windows.getNext();
			window.QueryInterface(Ci.nsIDOMWindow);
			loadIntoWindow(window);
			
		}
		
		Services.wm.addListener(WindowListener);
		
	}
	
	if(Services.appinfo.ID == "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}") {
		
		/* PaleMoon */
		
		var windows = Services.wm.getEnumerator("navigator:browser");
		while(windows.hasMoreElements()) {
			
			var window = windows.getNext();
			window.QueryInterface(Ci.nsIDOMWindow);
			loadIntoWindow(window);
			
		}
		
		Services.wm.addListener(WindowListener);
		
	}
	
	Services.obs.addObserver(ObsObserver, "http-on-modify-request", false);
	Services.prefs.addObserver("extensions.redirectcleaner.", PrefsObserver, false);
	
	this.History = [];
	
	this.Timer = {};
	Timer.highlight = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	Timer.unhighlight = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	Timer.pause = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	Timer.open = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	Timer.unpause = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	
}

function shutdown(data, reason) {
	
	if(Services.appinfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}") {
		
		/* Firefox */
		
		Cu.import("resource:///modules/CustomizableUI.jsm");
		CustomizableUI.destroyWidget("redirectcleaner-toolbarbutton");
		
	}
	
	if(Services.appinfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}") {
		
		/* SeaMonkey */
		
		var windows = Services.wm.getEnumerator("navigator:browser");
		while(windows.hasMoreElements()) {
			
			var window = windows.getNext();
			window.QueryInterface(Ci.nsIDOMWindow);
			unloadFromWindow(window);
			
		}
		
		Services.wm.removeListener(WindowListener);
		
	}
	
	if(Services.appinfo.ID == "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}") {
		
		/* PaleMoon */
		
		var windows = Services.wm.getEnumerator("navigator:browser");
		while(windows.hasMoreElements()) {
			
			var window = windows.getNext();
			window.QueryInterface(Ci.nsIDOMWindow);
			unloadFromWindow(window);
			
		}
		
		Services.wm.removeListener(WindowListener);
		
	}
	
	Services.obs.removeObserver(ObsObserver, "http-on-modify-request", false);
	Services.prefs.removeObserver("extensions.redirectcleaner.", PrefsObserver, false);
	
}

function install(data, reason) {
	
	if(reason == ADDON_UPGRADE) {
		
		if(data.oldVersion < "3.0.0") {
			
			var prefs = Services.prefs.getBranch("extensions.redirectcleaner.");
			prefs.deleteBranch("");
			
		}
		
	}
	
}

function uninstall(data, reason) {
}

function loadIntoWindow(window) {
	
	if(window.document.documentElement.getAttribute("windowtype") != "navigator:browser") { return; }
	
	var toolbarbutton = Widget.create(window.document);
	window.document.getElementById("navigator-toolbox").palette.appendChild(toolbarbutton);
	
	var toolbars = window.document.getElementsByTagName("toolbar");
	for(var i = 0; i < toolbars.length; i++) {
		
		var toolbar = toolbars[i];
		var currentset = toolbar.getAttribute("currentset").split(",");
		var index = currentset.indexOf("redirectcleaner-toolbarbutton");
		
		if(index != -1) {
			
			toolbar.insertItem(currentset[index], window.document.getElementById(currentset[index+1]));
			break;
			
		}
		
	}
	
}

function unloadFromWindow(window) {
	
	if(window.document.documentElement.getAttribute("windowtype") != "navigator:browser") { return; }
	
	var toolbarbutton = window.document.getElementById("redirectcleaner-toolbarbutton");
	if(toolbarbutton) { toolbarbutton.parentNode.removeChild(toolbarbutton); }
	
}

var WindowListener = {
	
	onOpenWindow: function(xulWindow) {
		
		var domWindow = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		domWindow.addEventListener("load", function() { loadIntoWindow(domWindow); }, false);
		
	},
	
	onCloseWindow: function(xulWindow) {
	},
	
	onWindowTitleChange: function(xulWindow, newTitle) {
	},
	
};

var ObsObserver = {
	
	observe: function(subject, topic, data) {
		
		if(topic == "http-on-modify-request") {
			
			subject.QueryInterface(Ci.nsIHttpChannel);
			if(subject.loadFlags & subject.LOAD_INITIAL_DOCUMENT_URI) {
				
				var original = subject.URI.spec;
				var clean = RedirectCleaner.clean(original);
				
				if(original != clean) {
					
					if(RedirectCleaner.prefs.mode == "whitelist" && !RedirectCleaner.whitelist(subject.URI.host, subject.URI.spec)) {
						
						History.push({ original: original, clean: clean });
						
						var uri = Services.io.newURI(clean, null, null);
						subject.redirectTo(uri);
						
						RedirectCleaner.highlight();
						
					}
					
					if(RedirectCleaner.prefs.mode == "blacklist" && RedirectCleaner.blacklist(subject.URI.host, subject.URI.spec)) {
						
						History.push({ original: original, clean: clean });
						
						var uri = Services.io.newURI(clean, null, null);
						subject.redirectTo(uri);
						
						RedirectCleaner.highlight();
						
					}
					
				}
				
			}
			
		}
		
	},
	
};

var PrefsObserver = {
	
	observe: function(subject, topic, data) {
		
		if(topic == "nsPref:changed") {
			
			RedirectCleaner.prefs();
			
		}
		
	},
	
};

var RedirectCleaner = {
	
	clean: function(url) {
		
		/* whitelist */
		var objPattern = /(?:^abp|account|login|logout|register|signin|signout|signon|signoff|signup)/i;
		if(objPattern.test(url)) {
			
			return url;
			
		}
		
		/* www */
		var objPattern = /[?&=](?:((?:www)[.][^?&;]*[?][^?]*)$|((?:www)[.][^?&;]*))/i;
		var arrMatches = objPattern.exec(url);
		if(arrMatches) {
			
			var value = (arrMatches[1] || arrMatches[2]);
			
			if(value.match(/(?:%25|%3A|%2F|%3F|%26|%3D|%23)/i)) {
				value = decodeURIComponent(value);
			}
			
			return RedirectCleaner.clean("http://" + value);
			
		}
		
		/* http */
		var objPattern = /[/?&=*+-](?:((?:ftp|http|https)[:][^?&;]*[?][^?]*)$|((?:ftp|http|https)[:][^?&;]*))/i;
		var arrMatches = objPattern.exec(url);
		if(arrMatches) {
			
			var value = (arrMatches[1] || arrMatches[2]);
			
			if(value.match(/(?:%25|%3A|%2F|%3F|%26|%3D|%23)/i)) {
				value = decodeURIComponent(value);
			}
			
			return RedirectCleaner.clean(value);
			
		}
		
		/* http */
		var objPattern = /[?&=*+-](?:((?:ftp|http|https)(?:%3A)[^?&;]*[?][^?]*)$|((?:ftp|http|https)(?:%3A)[^?&;]*))/i;
		var arrMatches = objPattern.exec(url);
		if(arrMatches) {
			
			var value = (arrMatches[1] || arrMatches[2]);
			return RedirectCleaner.clean(decodeURIComponent(value));
			
		}
		
		/* http */
		var objPattern = /[?&=*+-](?:((?:ftp|http|https)(?:%253A)[^?&;]*[?][^?]*)$|((?:ftp|http|https)(?:%253A)[^?&;]*))/i;
		var arrMatches = objPattern.exec(url);
		if(arrMatches) {
			
			var value = (arrMatches[1] || arrMatches[2]);
			return RedirectCleaner.clean(decodeURIComponent(decodeURIComponent(value)));
			
		}
		
		/* base64 */
		var objPattern = /[?&=~]((?:ZnRw|aHR0c)[^?&;~]*)/i;
		var arrMatches = objPattern.exec(url);
		if(arrMatches) {
			
			try {
				
				var value = Services.wm.getMostRecentWindow("navigator:browser").atob(decodeURIComponent(arrMatches[1]));
				
				if(value.match(/(?:%25|%3A|%2F|%3F|%26|%3D|%23)/i)) {
					value = decodeURIComponent(value);
				}
				
				return RedirectCleaner.clean(value);
				
			} catch(e) {
				
				Services.console.logStringMessage("RedirectCleaner: Error" + "\n" + e);
				
			}
			
		}
		
		return url;
		
	},
	
	whitelist: function(host, spec) {
		
		if(RedirectCleaner.prefs.regexp) {
			
			try {
				
				var regexp = new RegExp(RedirectCleaner.prefs.whitelist, "i");
				if(regexp.source && regexp.test(spec)) { return true; }
				
			} catch(e) {
				
				Services.console.logStringMessage("RedirectCleaner: Error" + "\n" + e);
				
			}
			
		}
		else {
			
			try {
				
				var items = RedirectCleaner.prefs.whitelist.split(",").sort();
				for(var i = 0; i < items.length; i++) {
					
					var item = items[i];
					if(item && host.indexOf(item) != -1) { return true; }
					
				}
				
			} catch(e) {
				
				Services.console.logStringMessage("RedirectCleaner: Error" + "\n" + e);
				
			}
			
		}
		
	},
	
	blacklist: function(host, spec) {
		
		if(RedirectCleaner.prefs.regexp) {
			
			try {
				
				var regexp = new RegExp(RedirectCleaner.prefs.blacklist, "i");
				if(regexp.source && regexp.test(spec)) { return true; }
				
			} catch(e) {
				
				Services.console.logStringMessage("RedirectCleaner: Error" + "\n" + e);
				
			}
			
		}
		else {
			
			try {
				
				var items = RedirectCleaner.prefs.blacklist.split(",").sort();
				for(var i = 0; i < items.length; i++) {
					
					var item = items[i];
					if(item && host.indexOf(item) != -1) { return true; }
					
				}
				
			} catch(e) {
				
				Services.console.logStringMessage("RedirectCleaner: Error" + "\n" + e);
				
			}
			
		}
		
	},
	
	highlight: function() {
		
		if(!RedirectCleaner.prefs.highlight) { return; }
		
		if(Services.appinfo.ID != "{aa3c5121-dab2-40e2-81ca-7ea25febc110}") {
			
			Timer.highlight.initWithCallback(function() {
				
				var windows = Services.wm.getEnumerator("navigator:browser");
				while(windows.hasMoreElements()) {
					
					var window = windows.getNext();
					window.QueryInterface(Ci.nsIDOMWindow);
					
					var toolbarbutton = window.document.getElementById("redirectcleaner-toolbarbutton");
					if(toolbarbutton) { toolbarbutton.classList.add("highlight"); }
					
				}
				
			}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
			
			Timer.unhighlight.initWithCallback(function() {
				
				var windows = Services.wm.getEnumerator("navigator:browser");
				while(windows.hasMoreElements()) {
					
					var window = windows.getNext();
					window.QueryInterface(Ci.nsIDOMWindow);
					
					var toolbarbutton = window.document.getElementById("redirectcleaner-toolbarbutton");
					if(toolbarbutton) { toolbarbutton.classList.remove("highlight"); }
					
				}
				
			}, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
			
		}
		
	},
	
	prefs: function() {
		
		var prefs = Services.prefs.getBranch("extensions.redirectcleaner.");
		RedirectCleaner.prefs.mode = prefs.getCharPref("mode");
		RedirectCleaner.prefs.whitelist = prefs.getCharPref("whitelist");
		RedirectCleaner.prefs.blacklist = prefs.getCharPref("blacklist");
		RedirectCleaner.prefs.regexp = prefs.getBoolPref("regexp");
		RedirectCleaner.prefs.highlight = prefs.getBoolPref("highlight");
		
		if(Services.appinfo.ID != "{aa3c5121-dab2-40e2-81ca-7ea25febc110}") {
			
			if(RedirectCleaner.prefs.mode == "whitelist") {
				
				var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
				var stylesheet = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
				try { stylesheet.unregisterSheet(io.newURI("chrome://redirectcleaner/skin/blacklist.css", null, null), stylesheet.USER_SHEET); } catch(e) {}
				try { stylesheet.loadAndRegisterSheet(io.newURI("chrome://redirectcleaner/skin/whitelist.css", null, null), stylesheet.USER_SHEET); } catch(e) {}
				
			}
			
			if(RedirectCleaner.prefs.mode == "blacklist") {
				
				var io = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
				var stylesheet = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
				try { stylesheet.unregisterSheet(io.newURI("chrome://redirectcleaner/skin/whitelist.css", null, null), stylesheet.USER_SHEET); } catch(e) {}
				try { stylesheet.loadAndRegisterSheet(io.newURI("chrome://redirectcleaner/skin/blacklist.css", null, null), stylesheet.USER_SHEET); } catch(e) {}
				
			}
			
		}
		
	},
	
};

var Widget = {
	
	create: function(document) {
		
		var toolbarbutton = document.createElement("toolbarbutton");
		toolbarbutton.setAttribute("id", "redirectcleaner-toolbarbutton");
		toolbarbutton.setAttribute("label", "RedirectCleaner");
		toolbarbutton.setAttribute("tooltiptext", "RedirectCleaner");
		toolbarbutton.setAttribute("onclick", "");
		toolbarbutton.setAttribute("context", "");
		toolbarbutton.setAttribute("class", "toolbarbutton-1");
		toolbarbutton.addEventListener("click", function(event) { Widget.click(event); });
		
		var panel = document.createElement("panel");
		panel.setAttribute("type", "arrow");
		panel.setAttribute("id", "redirectcleaner-panel");
		panel.addEventListener("popupshowing", function(event) { Widget.show(event); });
		panel.addEventListener("popuphiding", function(event) { Widget.hide(event); });
		toolbarbutton.appendChild(panel);
		
		var iframe = document.createElement("iframe");
		iframe.setAttribute("id", "redirectcleaner-iframe");
		iframe.setAttribute("src", "chrome://redirectcleaner/content/history.xul");
		iframe.setAttribute("width", "820");
		iframe.setAttribute("height", "300");
		panel.appendChild(iframe);
		
		return toolbarbutton;
		
	},
	
	click: function(event) {
		
		if(event.target.id == "redirectcleaner-toolbarbutton" && event.button == 0) {
			
			if(RedirectCleaner.prefs.mode == "whitelist") {
				
				var prefs = Services.prefs.getBranch("extensions.redirectcleaner.");
				prefs.setCharPref("mode", "blacklist");
				return;
				
			}
			
			if(RedirectCleaner.prefs.mode == "blacklist") {
				
				var prefs = Services.prefs.getBranch("extensions.redirectcleaner.");
				prefs.setCharPref("mode", "whitelist");
				return;
				
			}
			
		}
		
		if(event.target.id == "redirectcleaner-toolbarbutton" && event.button == 2) {
			
			var panel = event.target.ownerDocument.getElementById("redirectcleaner-panel");
			panel.openPopup(event.target, "", 0, 0, false, false);
			return;
			
		}
		
	},
	
	show: function(event) {
		
		if(event.target.id == "redirectcleaner-panel") {
			
			var document = event.target.ownerDocument.getElementById("redirectcleaner-iframe").contentDocument;
			var listbox = document.getElementById("redirectcleaner-listbox");
			
			for(var i = 0; i < History.length; i++) {
				
				var listitem = document.createElement("listitem");
				listitem.setAttribute("tooltiptext", "Original Link" + "\n" + History[i].original + "\n\n" + "Clean Link" + "\n" + History[i].clean);
				listitem.addEventListener("dblclick", function(event) { Widget.open(event); });
				
				var listcell = document.createElement("listcell");
				listcell.setAttribute("label", History[i].original);
				listcell.setAttribute("tooltiptext", History[i].original);
				listitem.appendChild(listcell);
				
				var listcell = document.createElement("listcell");
				listcell.setAttribute("label", History[i].clean);
				listcell.setAttribute("tooltiptext", History[i].clean);
				listitem.appendChild(listcell);
				
				listbox.appendChild(listitem);
				
			}
			
		}
		
	},
	
	hide: function(event) {
		
		if(event.target.id == "redirectcleaner-panel") {
			
			var document = event.target.ownerDocument.getElementById("redirectcleaner-iframe").contentDocument;
			var listbox = document.getElementById("redirectcleaner-listbox");
			
			while(listbox.itemCount) { listbox.removeItemAt(0); }
			
		}
		
	},
	
	open: function(event) {
		
		Timer.pause.initWithCallback(function() {
			
			Services.obs.removeObserver(ObsObserver, "http-on-modify-request", false);
			
		}, 0, Ci.nsITimer.TYPE_ONE_SHOT);
		
		Timer.open.initWithCallback(function() {
			
			Services.wm.getMostRecentWindow("navigator:browser").gBrowser.addTab(event.target.childNodes[0].getAttribute("label"));
			
		}, 100, Ci.nsITimer.TYPE_ONE_SHOT);
		
		Timer.unpause.initWithCallback(function() {
			
			Services.obs.addObserver(ObsObserver, "http-on-modify-request", false);
			
		}, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
		
	},
	
};
