// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond Cloud
//
// Copyright 2018 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('thingengine-core/lib/polyfill');
require('./polyfill');
process.on('unhandledRejection', (up) => { throw up; });

const assert = require('assert');
const Tp = require('thingpedia');

const WD = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');

const Config = require('../config');

const BASE_URL = process.env.THINGENGINE_URL || 'http://127.0.0.1:8080';

async function withSelenium(test) {
    const builder = new WD.Builder()
        .forBrowser('firefox');

    // on Travis CI we run headless; setting up Xvfb is
    // just annoying and not very useful
    if (process.env.TRAVIS) {
        builder
        .setFirefoxOptions(
            new firefox.Options().headless()
        )
        .setChromeOptions(
            new chrome.Options().headless()
        );
    }

    const driver = builder.build();
    try {
        await test(driver);
    } finally {
        driver.quit();
    }
}

const _checkedImages = new Set;

/**
 * Check that all images have URLs that return a valid image
 * (valid HTTP status and valid content-type).
 */
async function checkAllImages(driver) {
    const currentUrl = await driver.getCurrentUrl();
    const images = await driver.findElements(WD.By.css('img'));

    await Promise.all(images.map(async (img) => {
        const src = await img.getAttribute('src');

        // small optimization: we only check an image once
        // (we don't have dynamic images)
        // (we still need to use selenium to check images rather than
        // a linkchecker-style approach to make sure we catch JS-added
        // images)
        if (_checkedImages.has(src))
            return;
        _checkedImages.add(src);

        // this is not exactly what the browser does
        const res = await Tp.Helpers.Http.getStream(src, { extraHeaders: {
            Referrer: currentUrl
        }});
        assert(res.headers['content-type'].startsWith('image/'),
               `expected image/* content type for image, found ${res['content-type']}`);
        res.resume();
    }));
}

async function fillFormField(driver, id, ...value) {
    const entry = await driver.findElement(WD.By.id(id));
    await entry.sendKeys(...value);
}

async function login(driver, username, password) {
    await driver.get(BASE_URL + '/');

    const loginLink = await driver.wait(
        WD.until.elementLocated(WD.By.linkText('Log In')),
        30000);
    await checkAllImages(driver);
    await loginLink.click();

    const submit = await driver.wait(
        WD.until.elementLocated(WD.By.css('button.btn.btn-primary[type=submit]')),
        30000);
    await checkAllImages(driver);

    await fillFormField(driver, 'username', username);
    await fillFormField(driver, 'password', password);

    await submit.click();
}

async function testHomepage(driver) {
    await driver.get(BASE_URL + '/');

    const title = await driver.wait(
        WD.until.elementLocated(WD.By.id('almond-title')),
        30000);
    await checkAllImages(driver);

    assert.strictEqual(await title.getText(), 'Almond');
}

async function testLogin(driver) {
    await login(driver, 'bob', '12345678');
}

async function assertHasClass(element, className) {
    const classes = (await element.getAttribute('class')).split(' ');
    assert(classes.indexOf(className) >= 0,
        `expected ${element} to have class ${className}, found only [${classes}]`);
}
async function assertDoesNotHaveClass(element, className) {
    const classes = (await element.getAttribute('class')).split(' ');
    assert(classes.indexOf(className) < 0,
        `expected ${element} not to have class ${className}`);
}
async function assertElementValue(driver, cssSelector, expectedText) {
    const element = await driver.findElement(WD.By.css(cssSelector));
    assert.strictEqual(await element.getAttribute('value'), expectedText);
}

async function testRegister(driver) {
    await driver.get(BASE_URL + '/');

    // we click on Log In, and from there to Sign Up Now!

    const logIn = await driver.wait(
        WD.until.elementLocated(WD.By.linkText('Log In')),
        30000);
    await checkAllImages(driver);

    await logIn.click();

    const signUpNow = await driver.wait(
        WD.until.elementLocated(WD.By.linkText('Sign up as User')),
        30000);
    await checkAllImages(driver);

    await signUpNow.click();

    // now we're in the registration page
    const submit = await driver.wait(
        WD.until.elementLocated(WD.By.css('button.btn.btn-primary[type=submit]')),
        30000);

    await fillFormField(driver, 'username', 'alice');
    await fillFormField(driver, 'email', 'alice@localhost');
    await fillFormField(driver, 'password', '1234');

    // the help text should be red by now
    const min8CharText = await driver.wait(
        WD.until.elementLocated(WD.By.css('.has-error > #password + .help-block')),
        30000);
    // and we cannot submit
    await assertHasClass(submit, 'disabled');

    // fill some more text
    await fillFormField(driver, 'password', '5678');
    // wait 1s...
    await driver.sleep(1000);

    // and now the help text should not be red
    await assertDoesNotHaveClass(min8CharText, 'with-errors');
    // we still cannot submit tho
    await assertHasClass(submit, 'disabled');

    // fill the confirmation now
    await fillFormField(driver, 'confirm-password', '12345677');

    // uh oh! we made a typo!
    const confirmPasswordText = await driver.wait(
        WD.until.elementLocated(WD.By.css('.has-error > #confirm-password + .help-block')),
        30000);

    assert.strictEqual(await confirmPasswordText.getText(),
        `The password and the confirmation must match`);

    // change and go back
    await fillFormField(driver, 'confirm-password', WD.Key.BACK_SPACE, '8');

    // no more error
    await driver.wait(WD.until.elementIsNotVisible(confirmPasswordText), 30000);
    // and we can submit
    await assertDoesNotHaveClass(submit, 'disabled');

    // so let's do it!
    await submit.click();

    // we're logged in, so we get a nice link to the Settings page
    const settingsLink = await driver.wait(
        WD.until.elementLocated(WD.By.linkText('Settings')),
        30000);

    // let's click it...
    await settingsLink.click();

    // wait until enough of the form is loaded...
    await driver.wait(
        WD.until.elementLocated(WD.By.css('button.btn.btn-primary[type=submit]')),
        30000);

    // check it is us...
    await assertElementValue(driver, '#username', 'alice');
    await assertElementValue(driver, '#email', 'alice@localhost');
}

async function main() {
    await withSelenium(testHomepage);
    await withSelenium(testLogin);
    await withSelenium(testRegister);
}
module.exports = main;
if (!module.parent)
    main();
