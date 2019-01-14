"use strict";
(function() {
    window.ThingEngine = {};
    window.ThingEngine.getThingpedia = function() {
        return $('body[data-thingpedia-url]').attr('data-thingpedia-url') || '';
    };
})();
