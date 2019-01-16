#!/bin/bash

## Integration tests for Web Almond against public Thingpedia
## (API, web pages)

set -e
set -x
set -o pipefail

srcdir=`dirname $0`/..
srcdir=`realpath $srcdir`

DATABASE_URL="mysql://almond-enterprise:almond-enterprise@localhost/almond_enterprise_test"
export DATABASE_URL

if ! test -f $srcdir/secret_config.js ; then
	cat > $srcdir/secret_config.js <<'EOF'
module.exports.THINGPEDIA_URL = 'https://almond-dev.stanford.edu/thingpedia';
EOF
fi

# clean the database and bootstrap
$srcdir/scripts/execute-sql-file.js $srcdir/model/schema.sql
eval $(node $srcdir/scripts/bootstrap.js)

workdir=`mktemp -t -d webalmond-integration-XXXXXX`
workdir=`realpath $workdir`
on_error() {
    test -n "$frontendpid" && kill $frontendpid || true
    frontendpid=
    test -n "$masterpid" && kill $masterpid || true
    masterpid=
    wait

    # remove workdir after the processes have died, or they'll fail
    # to write to it
    rm -fr $workdir
}
trap on_error ERR INT TERM

oldpwd=`pwd`
cd $workdir

node $srcdir/tests/load_test_data.js

node $srcdir/backend/main.js &
masterpid=$!

node $srcdir/frontend.js &
frontendpid=$!

# in interactive mode, sleep forever
# the developer will run the tests by hand
# and Ctrl+C
if test "$1" = "--interactive" ; then
    sleep 84600
else
    # sleep until both processes are settled
    sleep 30

    # login as bob
    bob_cookie=$(node $srcdir/tests/login.js bob 12345678)
    # login as root
    root_cookie=$(node $srcdir/tests/login.js root rootroot)

    # run the automated link checker
    # first without login
    node $srcdir/tests/linkcheck.js
    # then as bob
    COOKIE="${bob_cookie}" node $srcdir/tests/linkcheck.js
    # then as root (admin)
    COOKIE="${root_cookie}" node $srcdir/tests/linkcheck.js

    # test the website by making HTTP requests directly
    node $srcdir/tests/test_website_basic.js

    # test the website in a browser
    SELENIUM_BROWSER=firefox node $srcdir/tests/test_website_selenium.js
fi

kill $frontendpid
frontendpid=
kill $masterpid
masterpid=
wait

rm -rf $workdir
