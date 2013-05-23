install-npm:
	brew install phantomjs # or similar
	npm install jslint
	npm install mocha
	npm install mocha-phantomjs
	npm install chai
	npm install yuicompressor

lint:
	node_modules/.bin/jslint stream.js

test:
	node_modules/.bin/mocha-phantomjs tests/stream.html

dist:
	node_modules/.bin/yuicompressor stream.js -o dist/stream.min.js
	ls -hl dist

httpd:
	screen -dmS m3httpd python -m SimpleHTTPServer
	
.PHONY: httpd test lint install-npm  dist