// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const path = require('path');
const Gettext = require('node-gettext');
const gettextParser = require('gettext-parser');
const fs = require('fs');

const languages = {};

function normalize(posixLocale) {
    const [language, country] = posixLocale.split(/[-_@.]/);
    if (country)
        return language + '-' + country.toUpperCase;
    else
        return language;
}

const locale = normalize(process.env.LANG || 'en_US.utf8');

function loadTextdomainDirectory(gt, locale, domain, modir) {
    let split = locale.split(/[-_.@]/);
    let mo = modir + '/' + split.join('_') + '.mo';

    while (!fs.existsSync(mo) && split.length) {
        split.pop();
        mo = modir + '/' + split.join('_') + '.mo';
    }
    if (split.length === 0)
        return;
    try {
        let loaded = gettextParser.mo.parse(fs.readFileSync(mo), 'utf-8');
        gt.addTranslations(locale, domain, loaded);
    } catch(e) {
        console.log(`Failed to load translations for ${locale}/${domain}: ${e.message}`);
    }
}

function load() {
    let gt = new Gettext();
    if (locale !== 'en-US') {
        let modir = path.resolve(path.dirname(module.filename), '../po');//'
        loadTextdomainDirectory(gt, locale, 'almond-enterprise', modir);
        modir = path.resolve(path.dirname(module.filename), '../node_modules/thingtalk/po');
        loadTextdomainDirectory(gt, locale, 'thingtalk', modir);
        modir = path.resolve(path.dirname(module.filename), '../node_modules/almond/po');
        loadTextdomainDirectory(gt, locale, 'almond', modir);
        modir = path.resolve(path.dirname(module.filename), '../node_modules/thingengine-core/po');
        loadTextdomainDirectory(gt, locale, 'thingengine-core', modir);
    }
    gt.textdomain('almond-enterprise');
    gt.setLocale(locale);
    gt.locale = locale;
    return gt;
}
const language = load();

module.exports = {
    localeToLanguage(locale) {
        // only keep the language part of the locale, we don't
        // yet distinguish en_US from en_GB
        return (locale || 'en').split(/[-_@.]/)[0];
    },

    get() {
        return language;
    }
};
