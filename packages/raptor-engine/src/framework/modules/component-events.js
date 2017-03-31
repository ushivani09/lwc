import assert from "../assert.js";
import {
    removeComponentEventListener,
    addComponentEventListener,
} from "../component.js";
import { assign, create, isUndefined } from "../language.js";

const EmptyObj = create(null);

function syncEvents(oldVnode: VNode, vnode: ComponentVNode) {
    const { vm } = vnode;
    if (isUndefined(vm)) {
        return;
    }

    let { data: { _on: newOn } } = vnode;
    if (isUndefined(vm.cmpEvents)) {
        assert.invariant(vnode.data.on === undefined, 'vnode.data.on should be undefined.');
        vnode.data.on = newOn; // short-circuite for the case where there is no event from within
        return;
    }
    let { data: { _on: oldOn } } = oldVnode;
    let key: string, cur: any, old: any;

        // infuse key-value pairs from _on into the component
    if (oldOn !== newOn && (oldOn || newOn)) {
        oldOn = oldOn || EmptyObj;
        newOn = newOn || EmptyObj;
        // removed event handlers should be reset in component's events
        for (key in oldOn) {
            if (!(key in newOn)) {
                removeComponentEventListener(vm, key, oldOn[key]);
            }
        }

        // new or different event handlers should be set in component's events
        for (key in newOn) {
            cur = newOn[key];
            old = oldOn[key];
            if (key in oldOn && old != cur) {
                removeComponentEventListener(vm, key, oldOn[key]);
            }
            if (oldOn[key] != cur) {
                addComponentEventListener(vm, key, cur);
            }
        }
    }

    // reflection of component event handlers into data.on for the regular diffing algo
    if (vm.cmpEvents) {
        assert.invariant(vnode.data.on === undefined, 'vnode.data.on should be undefined.');
        vnode.data.on = assign({}, vm.cmpEvents);
    }
}

export default {
    create: syncEvents,
    update: syncEvents,
};
