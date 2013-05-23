/*jslint browser: true, plusplus: true */
/*!
stream.js, by Anders Ytterström (c) 2013
Docs: https://github.com/madr/stream.js

Free to distribute under the MIT License: 
http://opensource.org/licenses/MIT
*/
(function (global) {
    "use strict";

    var Stream, Page, pxgif, httpObj;

    // Good ol' 1px gif, no-http-requests-please edition
    pxgif = "data:image/gif;base64,R0lGODlhAQABAIAAAA" +
             "AAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    /**
     * Stream is a container of pages. It makes sure the Pages
     * have the right conditions. 
     *
     *  1. The current Page is loaded and visible.
     *
     *  2. The most previous Page AND the top next Page is 
     *     loaded but outside viewport.
     *
     *  3. The second-most previous Page AND the second-most
     *     next Page is loaded but without images. They are 
     *     replaced by base64 encoded 1px.gif
     *
     *  4. The third-most previous Page AND the third-most
     *     next Page is like above, and also invisble with 
     *     CSS.
     *
     *  5. The rest of the pages are removed from the DOM.
     *
     * Madness you say? This code is based on field wisdom:
     *
     * "LinkedIn for iPad: 5 techniques for smooth infinite 
     * scrolling in HTML5" - http://linkd.in/JG1urJ
     */

    httpObj = function () {
        var xhr = false;

        if (window.XMLHttpRequest) {
            xhr = new XMLHttpRequest();
        }

        return xhr;
    };

    Stream = function (elem, pageElems) {
        var i,
            pages = [],
            numberOfPages = pageElems.length;

        this.stream = elem;

        for (i = 0; i < numberOfPages; i++) {
            pages[i] = new Page(pageElems[i]);
        }

        this.pages = pages;
        this.last = pages.length;
    };

    Stream.prototype = {
        constructor: Stream,

        injectPage: function (elem) {
            this.pages.push(new Page(elem));
            this.last = this.pages.length;
        },

        fetchPage: function (url, callback) {
            var request = httpObj();
            if (request) {
                request.onreadystatechange = function () {
                    if (request.readyState === 4) {
                        if (request.status === 200 || request.status === 304) {
                            callback(request.responseText);
                        }
                    }
                };
                request.open("GET", url, true);
                request.send(null);
            }
        },

        loadPage: function (page) {
            // load a page by using ajax (page.source).
            if (!page.loaded && page.source !== undefined) {
                this.fetchPage(page.source, function (bd) {
                    var d = document.createElement("div");
                    d.innerHTML = bd;
                    page.content.appendChild(d);
                    page.load(page.content);
                });
            }
        },

        fixPresent: function (page) {
            // makes sure a page is fully visible.
            var p  = this.pages[page];

            if (!p.loaded) { p.load(p.content); }

            p.loadImgs();
            p.makeVis();
            p.readd();
        },

        fixFuture: function (page) {
            // next page should exists in DOM tree,
            // have loaded images and be visible.
            // if not loaded yet, it's about time
            // it is.
            if (++page < this.last) {
                this.loadPage(this.pages[page]);
                this.pages[page].makeVis();
                this.pages[page].loadImgs();
                this.pages[page].readd();
            }

            // the page after the next page
            // should be as above, but without
            // images loaded.
            if (++page < this.last) {
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeVis();
                this.pages[page].readd();
            }

            // the page after the page after the next page
            // should have no images and be invisible.
            if (++page < this.last) {
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeInvis();
                this.pages[page].readd();
            }

            // the pages beyond that should simply be removed
            // until the stream requires them to be re-added.
            while (++page < this.last) {
                this.pages[page].remove();
            }
        },

        fixPast: function (page) {
            // prev page should exists in DOM tree,
            // have loaded images and be visible.
            // if not loaded yet, it's about time
            // it is.
            if (page-- > 0) {
                this.loadPage(this.pages[page]);
                this.pages[page].makeVis();
                this.pages[page].loadImgs();
                this.pages[page].readd();
            }

            // the page before the prev page
            // should be as above, but without
            // images loaded.
            if (page-- > 0) {
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeVis();
                this.pages[page].readd();
            }

            // the page before the page before the prev page
            // should have no images and be invisible.
            if (page-- > 0) {
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeInvis();
                this.pages[page].readd();
            }

            // the pages beyond that should simply be removed
            // until the stream requires them to be re-added.
            while (page-- > 0) {
                this.pages[page].remove();
            }
        },

        gotoX: function (page, direction) {
            if (direction === undefined) { direction = "both"; }

            /*
            ADEPRIMO.Mobile.Event.trig({type: "m3:article:beforeChangeCurrent", 
                oldCurrent: this.pages[this.current], 
                newCurrent: page 
            });
            */

            this.current = page;

            // make sure current page is ok
            this.fixPresent(page);

            // going forward first
            if (direction !== "prev") {
                this.fixFuture(page);
            }

            // down with forward, now backwards
            if (direction !== "next") {
                this.fixPast(page);
            }

            /*
            ADEPRIMO.Mobile.Event.trig({type: "m3:article:afterChangeCurrent", 
                current: page,
                elem: this.pages[page] 
            });
            */
        },

        /* Called on page load. Will fallback on first Page 
        if Page is not specified. */
        init: function (pageNum) {
            this.gotoX(pageNum || 0);

            /*
            global.ADEPRIMO.Mobile.Event.add("m3:carousel:prev", (function (stream) {
                return function (evt) {
                    stream.gotoPrev();
                };
            }(this)));

            global.ADEPRIMO.Mobile.Event.add("m3:carousel:next", (function (stream) {
                return function (evt) {
                    stream.gotoNext();
                };
            }(this)));

            global.ADEPRIMO.Mobile.Event.add("m3:carousel:paneChange", (function (stream) {
                return function (evt) {
                    stream.gotoX(evt.pane, evt.direction || "both");
                };
            }(this)));

            global.ADEPRIMO.Mobile.Event.add("m3:carousel:paneResize", (function (stream) {
                return function (evt) {
                    stream.resizePages(evt.x);
                };
            }(this)));
            */
        },

        resizePages: function (x) {
            /* untested! */
            var pages = this.pages, i, max = pages.length;

            for (i = 0; i < max; i++) {
                pages[i].content.style.width = x + "px";

                if (pages[i].loaded) {
                    pages[i].dummy.style.width = x + "px";
                }
            }
        },

        // goto next Page.
        gotoNext: function () {
            var n = this.current;
            if (n < (this.pages.length - 1)) {
                n++;
            }
            this.gotoX(n);
        },

        // goto prev page.
        gotoPrev: function () {
            var p = this.current;
            if (p > 0) {
                p--;
            }
            this.gotoX(p);
        }
    };

    /**
     * Pages are HTML Elements in the DOM tree
     * which can have several states. The states are
     * not managed by the Page itself, but by the 
     * Stream they belong to.
     */
    Page = function (elem) {
        // The element is attached to
        // DOM tree, and is either loaded (has content loaded
        // already) or not loaded (holds a data-source attribute
        // pointing to a url from which the content can be
        // loaded with ajax).
        var source = elem.getAttribute("data-source");
        if (source) {
            this.loaded = false;
            this.source = source;
            this.content = elem;
        } else {
            this.load(elem);
        }
    };

    Page.prototype = {
        constructor: Page,

        /* recieve a element attached to the DOM and load it 
           to the page. Typical callback after a successfull 
           ajax call. */
        load: function (elem) {
            // asumes the content is already attached to
            // the DOM tree.
            this.content = elem;
            this.parent = elem.parentNode;

            // dummy is used to remember where the page
            // should be re-added once it has been removed.
            var dummy = document.createElement("span");
            dummy.className = this.content.className;
            this.dummy = dummy;

            // get some research about the images of the 
            // article. set here to avoid WET behavior.
            this.imgs = elem.getElementsByTagName("img");
            this.imgsLen = this.imgs.length;

            // content or the element is loaded and
            // is now available to the application,
            // source is no needed anymore.
            this.loaded = true;
            this.source = undefined;
            this.content.removeAttribute("data-source");

            // initial state: fully visible,
            // all images are loaded, 
            // and removal has not yet happen.
            this.pageInvis = false;
            this.imgsUnloaded = false;
            this.pageRemoved = false;
        },

        /* removes the Page from DOM. keeps it in memory. */
        remove: function () {
            if (!this.loaded || this.pageRemoved) { return; }
            // a dummy is used to remember the position in the 
            // DOM tree.
            if (this.content.style.width) {
                this.dummy.style.width = this.content.style.width;
            }
            this.parent.insertBefore(this.dummy, this.content);
            this.content = this.parent.removeChild(this.content);
            this.pageRemoved = true;
        },

        /* add the Page to DOM. */
        readd: function () {
            if (!this.loaded || !this.pageRemoved) { return; }
            // the dummy is kept if needed again.
            if (this.dummy.style.width) {
                this.content.style.width = this.dummy.style.width;
            }
            this.parent.insertBefore(this.content, this.dummy);
            this.dummy = this.parent.removeChild(this.dummy);
            this.pageRemoved = false;
        },

        /* unload images from DOM by replacing them with 1px gif. 
           src are stored in a data- attribute. */
        unloadImgs: function () {
            if (!this.loaded || this.imgsUnloaded) { return; }

            var i, max, im, dataAttrSet, imgs = this.imgs;

            dataAttrSet = this.imgsLen && !!imgs[0].getAttribute("data-src");

            for (i = 0, max = this.imgsLen; i < max; i++) {
                im = imgs[i];

                if (!dataAttrSet) {
                    im.setAttribute("data-src", im.src);
                }

                im.src = pxgif;
            }

            this.imgsUnloaded = true;
        },

        /* restore images from data-src attribute. */
        loadImgs: function () {
            if (!this.loaded || !this.imgsUnloaded) { return; }

            var i, max, im, imgs = this.imgs;

            for (i = 0, max = this.imgsLen; i < max; i++) {
                im = imgs[i];

                im.src = im.getAttribute("data-src");
            }

            this.imgsUnloaded = false;
        },

        addClass: function (c) {
            this.content.classList.add(c);
        },

        removeClass: function (c) {
            this.content.classList.remove(c);
        },

        /* hides article with CSS. */
        makeInvis: function () {
            if (!this.loaded || this.pageInvis) { return; }
            this.addClass("is-hidden");
            this.pageInvis = true;
        },

        /* show article from hidden state. */
        makeVis: function () {
            if (!this.loaded || !this.pageInvis) { return; }
            this.removeClass("is-hidden");
            this.pageInvis = false;
        }
    };

    /**
     * Attach events
     */
    /*
    global.ADEPRIMO.Mobile.Event.add("m3:carousel:init", function (evt) {
        var streamElem = document.getElementById(evt.elemId),
            pages = document.querySelectorAll(evt.panes),
            stream;

        stream = new Stream(streamElem, pages);
        stream.init(evt.startingPane || 0);

        global.ADEPRIMO.Mobile.Event.add("m3:carousel:inject", (function (stream) {
            return function (evt) {
                var i;
                for (i = 0; i < evt.data.length; i++) {
                    stream.injectPage(evt.data[i]);
                }
            };
        }(stream)));
    });
    */
    /* end of events */

    // assign objects to global scope.
    global.stream = {};
    global.stream.Page = Page;
    global.stream.Stream = Stream;
}(this));