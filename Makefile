all: prepare

prepare: prepare-bundles prepare-mo

public/javascripts/%-bundle.js : browser/%.js browser/deps/*
	browserify -o $@ $<

bundles :=

prepare-bundles: $(foreach b,$(bundles),public/javascripts/$(b)-bundle.js)

%.mo: %.po
	msgfmt $< -o $@

languages :=
prepare-mo: $(foreach l,$(languages),po/$(l).mo)

.PHONY: prepare prepare-bundles prepare-mo
