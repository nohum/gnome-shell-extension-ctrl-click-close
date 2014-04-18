/**
 * Middle click closes windows in window overview.
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
let changedWindowCloneActors;
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
	originalWindowCloneInit = undefined;
	originalWindowOverlayInit = undefined;
	changedWindowCloneActors = [];
	connectedWindowOverlaySignals = [];

	originalWindowCloneInit = injectToFunction(Workspace.WindowClone.prototype, '_init', function(realWindow, workspace) {		
		// actually, as we are removing all actions we may conflict with other extensions, but there
		// seems no other way to attach a Clutter.ClickAction, as the original one in the Gnome Shell
		// source-code consums *all* clicks.
		this.actor.clear_actions();

		// see the following link for the original source:
		// https://git.gnome.org/browse/gnome-shell/tree/js/ui/workspace.js?h=gnome-3-12#n151

		let clickAction = new Clutter.ClickAction();
		clickAction.connect('clicked', Lang.bind(this, function(action, actor) {
			let event = Clutter.get_current_event();
			if ((event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0) {
				this.emit('close-requested');
				return;
			}

			this._onClicked(action, actor);
		}));

		clickAction.connect('long-press', Lang.bind(this, this._onLongPress));
		
		changedWindowCloneActors.push({actor: this.actor, that: this});
		this.actor.add_action_with_name('modified-click', clickAction);

		// rebuild these events as these also have been removed
		this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
		this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
	      	this.actor.connect('enter-event', Lang.bind(this, this._onEnter));
	});

	originalWindowOverlayInit = injectToFunction(Workspace.WindowOverlay.prototype, '_init', function(windowClone, parentActor) {
		let signal = windowClone.connect('close-requested', Lang.bind(this, this._closeWindow));
		connectedWindowOverlaySignals.push({window: windowClone, signal: signal});
	});
}

function disable() {

	if (originalWindowCloneInit !== undefined) {
		Workspace.WindowClone.prototype['_init'] = originalWindowCloneInit;
	}

	if (originalWindowOverlayInit !== undefined) {
		Workspace.WindowOverlay.prototype['_init'] = originalWindowOverlayInit;
	}

	let changedActor;
	for each (changedActor in changedWindowCloneActors) {
		if (typeof changedActor.actor !== "undefined" && typeof changedActor.that !== "undefined") {
        		changedActor.actor.remove_action_by_name('modified-click');

			// reapply original click action
			let clickAction = new Clutter.ClickAction();
			clickAction.connect('clicked', Lang.bind(changedActor.that, changedActor.that._onClicked));
			clickAction.connect('long-press', Lang.bind(changedActor.that, changedActor.that._onLongPress));
			
			changedActor.actor.add_action(clickAction);			
		}
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
