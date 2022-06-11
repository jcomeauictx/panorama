# allow bashisms in Makefile
SHELL := /bin/bash
BROWSER ?= chromium
HOST ?= localhost
PORT ?= 3232
CGI_TEST_ARGS ?= message=this+is+a+test
TMP ?= $(shell python3 -c "import tempfile; print(tempfile.gettempdir())")
VALIDATOR := https://validator.w3.org/nu
REF := ../../gdavis/{panorama,earthcurvature,hgtread}.py
URL := http://$(HOST):$(PORT)/?latitude=24.164640&longitude=-110.312864&bearing=-20.0
export
all: serve test
$(TMP)/panorama.zip: $(TMP)/panorama Makefile
	rm -f $@
	cd $(@D) && zip -r $(@F) $(<F)
$(TMP)/panorama: panorama.js .FORCE
	rm -rf $@
	mkdir -p $@
	cp -f $(filter-out .FORCE, $+) $@
%: %.ps
	display -page 128x128 $<
%.png: %.ps
	convert -page 128x128 $< $@
raw_fetch: cgi-bin/fetch.py
	./$< http://jc.unternet.net/test.cgi
fetch: cgi-bin/fetch.py
	./$< N24W111
serve:
	python3 -OO -m http.server --bind $(HOST) --cgi $(PORT) & \
	 echo $$! > $(TMP)/panorama.pid
kill:
	kill $$(<$(TMP)/panorama.pid)
android:
	am start -a  android.intent.action.VIEW -d "$(URL)"
test:
	$(BROWSER) "$(URL)"
%.test: cgi-bin/%.py
	curl -d "$(CGI_TEST_ARGS)" http://$(HOST):$(PORT)/$<
env:
	$@
validate: index.html
	scp $< tektonic.unternet.net:/var/www/jcomeau.com/tmp/panorama.html
	$(BROWSER) $(VALIDATOR)/?doc=http://jcomeau.com/tmp/panorama.html
edit: Makefile panorama.js
	vi $+ $(REF)
%.doctest: %.py
	python3 -m doctest $<
androiddebug:
	$(BROWSER) 'chrome://inspect/#devices'
	@echo You will need to refresh the page for it to work.
.FORCE:
