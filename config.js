// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// The CDN to use for website assets (javascript, css, images files contained in public/ )
// If you are using CloudFront+S3, you can use `./scripts/sync-assets-to-s3.sh ${s3_bucket}`
// to upload the assets. If you are using CloudFront+ELB, you can simply point the
// CDN to the almond-cloud website; the website will act as origin server for the content
// and set appropriate cache headers.
// Use a fully qualified URL (including https://) and omit the trailing slash.
// Leave blank if you do not want to use a CDN, in which case assets will
// be loaded directly from the almond-cloud website.
module.exports.ASSET_CDN = '';

// Address of the backend process (as ip:port)
module.exports.BACKEND_ADDRESS = '127.0.0.1:8001';

module.exports.THINGPEDIA_URL = 'https://thingpedia.stanford.edu/thingpedia';
module.exports.DEVELOPER_KEY = null;

// the origin (scheme, hostname, port) where the server is reachable
// this is used for redirects, and to enable special behavior for the main
// Almond website
module.exports.SERVER_ORIGIN = 'http://127.0.0.1:8080';

// enable Strict-Transport-Security, Content-Security-Policy and other
// security related headers
// requires TLS
module.exports.ENABLE_SECURITY_HEADERS = false;

// override which pug file to use for about pages
// use this to customize the index, terms-of-service, etc. pages
// the key should be the page name (part of path after /about)
// the value should be the name of a pug file in views, without the .pug
// extension
// if unspecified, defaults to "about_" + page_name, eg. for research
// it defaults to showing about_research.pug
//
// use ABOUT_OVERRIDE['index'] to override the whole website index
// note that "/about" with no page unconditionally redirects to "/"
module.exports.ABOUT_OVERRIDE = {};

// adds new pages to the /about hierarchy
// the format should be:
// {
//   url: path name, excluding /about part
//   title: page title
//   view: name of pug file
//   navbar: link label in navbar, or null to exclude from the navbar
// }
module.exports.EXTRA_ABOUT_PAGES = [];

// additional origins that should be allowed to make Cookie-authenticated
// API requests
module.exports.EXTRA_ORIGINS = [];

// the URL of a luinet-compatible Natural Language parsing server
module.exports.NL_SERVER_URL = 'https://almond-nl.stanford.edu';

// Mailgun user/password for emails sent from Almond
module.exports.MAILGUN_USER = null;
module.exports.MAILGUN_PASSWORD = null;

// From: field of user emails (email verification, password reset, etc.)
module.exports.EMAIL_FROM_USER = 'Almond <noreply@medxchange.almond.stanford.edu>';
// From: field of admin emails (review requests, developer requests, etc.)
module.exports.EMAIL_FROM_ADMIN = 'Almond <root@medxchange.almond.stanford.edu>';
// To: field of admin emails
module.exports.EMAIL_TO_ADMIN = 'thingpedia-admins@lists.stanford.edu';

// load more configuration that should not go in git (eg secret keys)
try {
    Object.assign(module.exports, require('./secret_config.js'));
} catch(e) {
    // ignore if there is no file
}
