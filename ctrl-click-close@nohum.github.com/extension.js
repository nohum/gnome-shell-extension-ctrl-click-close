/**
 * CTRL+Click closes windows in window overview.
 * 
 * Version 1.0.1
 *
 * by Wolfgang Gaar
 * http://github.com/nohum/gnome-shell-extension-middle-click-overview
 */

const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Workspace = imports.ui.workspace;

let originalWindowCloneInit;
let originalWindowOverlayInit;
let connectedWindowOverlaySignals;

// original source of this function: see https://git.gnome.org/browse/gnome-shell-extensions/tree/extensions/windowsNavigator/extension.js?h=gnome-3-10#n11
function injectToFunction(parent, name, func) {
	let origin = parent[name];
	
	parent[name] = function() {
		let ret;
		ret = origin.apply(this, arguments);
		if (ret === undefined)
		ret = func.apply(this, arguments);
		return ret;
	}

	return origin;
}

function init() {
	/* do nothing */
}

function enable() {
	originalWindowCloneClicked = undefined;
	originalWindowOverlayInit = undefined;
	connectedWindowOverlaySignals = [];

	originalWindowCloneClicked = injectToFunction(Workspace.WindowClone.prototype, '_onClicked', function(action, actor) {		
		let event = Clutter.get_current_event();
		if (event.get_state() & Clutter.ModifierType.CONTROL_MASK) {
			this.emit('close-requested');
			return;
		}

		// this is going to throw a warning at injection-time as at this point that variable is not refering to the original function yet.
		originalWindowCloneClicked._onClicked(action, actor);
	});

	originalWindowOverlayInit = injectToFunction(Workspace.WindowOverlay.prototype, '_init', function(windowClone, parentActor) {
		let signal = windowClone.connect('close-requested', Lang.bind(this, this._closeWindow));
		connectedWindowOverlaySignals.push({window: windowClone, signal: signal});
	});
}

function disable() {
	if (originalWindowCloneClicked !== undefined) {
		Workspace.WindowClone.prototype['_onClicked'] = originalWindowCloneClicked;
	}

	if (originalWindowOverlayInit !== undefined) {
		Workspace.WindowOverlay.prototype['_init'] = originalWindowOverlayInit;
	}

	let connectedSignal;
	for each (connectedSignal in connectedWindowOverlaySignals) {
		if (typeof connectedSignal.window !== "undefined") {
        		try {
				connectedSignal.window.disconnect(connectedSignal.signal);
			} catch (e) {
				log("on disabling extension: " + e);
			}
		}
	}
}
