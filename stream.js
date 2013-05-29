/*jslint browser: true, plusplus: true */
/*!
stream.js, by Anders Ytterström (c) 2013
Docs: https://github.com/madr/stream.js

Free to distribute under the MIT License: 
http://opensource.org/licenses/MIT
*/
(function (g) {
    "use strict";

    var Stream, Page, Helper, pxgif;

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

    Helper = (function () {
        return {
            addClass: function (elem, c) {
                elem.classList.add(c);
            },

            removeClass: function (elem, c) {
                elem.classList.remove(c);
            },

            httpObj: function () {
                var xhr = false;

                if (g.XMLHttpRequest) {
                    xhr = new g.XMLHttpRequest();
                } else if (g.ActiveXObject) {
                    try {
                        xhr = new g.ActiveXObject("Msxml2.XMLHTTP");
                    } catch (e) {
                        xhr = false;
                    }
                }

                return xhr;
            }
        };
    }());

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
            var request = Helper.httpObj();
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

        fixPage: function (page, state) {
            switch (state) {
                // next/prev page should exists in DOM tree,
                // have loaded images and be visible.
                // if not loaded yet, it's about time
                // it is.
            case 1:
                this.loadPage(this.pages[page]);
                this.pages[page].makeVis();
                this.pages[page].loadImgs();
                this.pages[page].readd();
                break;
            // the page after the next/prev page
            // should be as above, but without
            // images loaded.
            case 2:
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeVis();
                this.pages[page].readd();
                break;

            // the page after the page after the next/prev page
            // should have no images and be invisible.
            case 3:
                this.loadPage(this.pages[page]);
                this.pages[page].unloadImgs();
                this.pages[page].makeInvis();
                this.pages[page].readd();
                break;
            // the pages beyond that should simply be removed
            // until the stream requires them to be re-added.
            case 4:
                this.pages[page].remove();
                break;
            }
        },

        fixFuture: function (page) {

            if (++page < this.last) {
                this.fixPage(page, 1);
            }

            if (++page < this.last) {
                this.fixPage(page, 2);
            }

            if (++page < this.last) {
                this.fixPage(page, 3);
            }

            while (++page < this.last) {
                this.fixPage(page, 4);
            }
        },

        fixPast: function (page) {
            if (page-- > 0) {
                this.fixPage(page, 1);
            }

            if (page-- > 0) {
                this.fixPage(page, 2);
            }

            if (page-- > 0) {
                this.fixPage(page, 3);
            }

            while (page-- > 0) {
                this.fixPage(page, 4);
            }
        },

        gotoX: function (page, direction) {
            if (direction === undefined) { direction = "both"; }

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
        },

        /* Called on page load. Will fallback on first Page 
        if Page is not specified. */
        init: function (pageNum) {
            this.gotoX(pageNum || 0);
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
        },

        // add page to stream, in 3 different places:
        // 1) last, 2) first, 3) custom location
        addPage: function (elem, pos) {
            var page;

            if (pos === undefined) { pos = true; }

            // elem should be in the DOM already,
            // either with data-source (not loaded yet) 
            // or loaded content.
            page = new Page(elem);

            // default: append the page to the stream.
            if (pos === true) {
                this.pages.push(page);
                return;
            }

            // prepend the page to the stream.
            if (pos === false) {
                this.pages.unshift(page);
                return;
            }

            // asuming (hoping) pos is an int
            // and try to use it as a custom
            // location for the new page.
            pos = parseInt(pos, 10);
            this.pages.splice(pos, 0, page);
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
            if (this.content.style.length) {
                this.dummy.style = this.content.style;
            }
            this.dummy.className = this.content.className;
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

        /* hides article with CSS. */
        makeInvis: function () {
            if (!this.loaded || this.pageInvis) { return; }
            Helper.addClass(this.content, "is-hidden");
            this.pageInvis = true;
        },

        /* show article from hidden state. */
        makeVis: function () {
            if (!this.loaded || !this.pageInvis) { return; }
            Helper.removeClass(this.content, "is-hidden");
            this.pageInvis = false;
        }
    };

    // assign objects to global scope.
    g.streamjs = {};
    g.streamjs.Helper = Helper;
    g.streamjs.Page = Page;
    g.streamjs.Stream = Stream;
}(this));