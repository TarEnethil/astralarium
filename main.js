(function() {
    var gid = function(id) { return document.getElementById(id); };

    var CANVAS_WIDTH = window.innerWidth;
    var CANVAS_HEIGHT = window.innerHeight - gid("nav").clientHeight;
    var PADDING = 20;

    var STAR_DEFAULT_SIZE = 4;
    var STAR_MIN_SIZE = 2;
    var STAR_MAX_SIZE = 9;
    var LINE_DEFAULT_SIZE = 2;
    var LINE_MIN_SIZE = 1;
    var LINE_MAX_SIZE = 5;

    rando = fabric.util.getRandomInt;

    // global map of stars (uuid => fabric.Circle)
    var _stars = new Map();
    // global map of lines (uuid => fabric.Line)
    var _lines = new Map();
    // gloap map of text elemeds (uuid => fabric.Text)
    var _texts = new Map();

    // global current mode
    var _mode;

    // stores the values of the attribute panel when leaving Add mode
    // contains default values for the first enterAddMode()
    var _starAttributeCache = {
        name: {
            value: "Unnamed Star",
            disabled: false
        },
        color1: {
            value: "#ffffff",
            disabled: false,
            tooltip: "Inner Star Color"
        },
        color2: {
            value: "#cccccc",
            disabled: false,
            tooltip: "Outer Star Color"
        },
        size: {
            value: STAR_DEFAULT_SIZE,
            disabled: false,
            min: STAR_MIN_SIZE,
            max: STAR_MAX_SIZE
        }
    };

    // stores the values of the attribute panel when leaving Line mode
    // contains default values for the first enterLineMode()
    var _lineAttributeCache = {
        // lines don't have a name -> disable
        name: {
            value: "disabled",
            disabled: true
        },
        // lines only have one color -> disable
        color1: {
            value: "#cccccc",
            disabled: true,
            tooltip: "disabled"
        },
        // color2 + size looks better than color1 + size
        // because a disabled (=invisible) color2 leaves a big gap
        color2: {
            value: "#ffffff",
            disabled: false,
            tooltip: "Line Color"
        },
        size: {
            value: LINE_DEFAULT_SIZE,
            disabled: false,
            min: LINE_MIN_SIZE,
            max: LINE_MAX_SIZE
        }
    };

    // stores the values of the attribute panel when leaving text mode
    // contains default values for the first enterTextMode
    var _textAttributeCache = {
        // actual text
        name: {
            value: "Text",
            disabled: false
        },
        color1: {
            value: "#ffffff",
            disabled: false,
            tooltip: "Inner Color"
        },
        color2: {
            value: "#ffffff",
            disabled: false,
            tooltip: "Border Color"
        },
        // size is controlled via the fabric Controls
        size: {
            disabled: true
        }
    };

    // set up hotkeys
    document.addEventListener('keyup', e => {
        if (e.key == 'n') {
            gid("button-canvas").click();
        } else if (e.key == 's') {
            gid("button-save").click();
        } else if (e.key == 'b') {
            gid("button-background").click();
        } else if (e.key == 'r') {
            gid("button-random").click();
        } else if (e.key == 'h') {
            gid("button-info").click();
        } else if (e.key === 'i') {
            enterAddMode();
        } else if (e.key === 'e') {
            enterEditMode();
        } else if (e.key === 'l') {
            enterLineMode();
        } else if (e.key === 't') {
            enterTextMode();
        } else if (e.key === 'd') {
            enterDeleteMode();
        } else if (e.key === 'Escape') {
            resetMode();
            closePopups();
        };
    });

    // don't propagate keyup events when entering text, except for Esc
    var inputs = document.querySelectorAll("input");
    inputs.forEach(i => {
        i.addEventListener('keyup', e => {
            if (e.key != 'Escape') {
                e.stopPropagation();
            }
        });
    });

    // set up onclick listeners for mode buttons
    function setupModeListener(mode, func) {
        gid("mode-star-" + mode).addEventListener("click", e => {
            e.preventDefault();
            document.activeElement.blur();
            func();
        });
    }

    setupModeListener("add", enterAddMode);
    setupModeListener("edit", enterEditMode);
    setupModeListener("line", enterLineMode);
    setupModeListener("text", enterTextMode);
    setupModeListener("delete", enterDeleteMode);

    // returns the content of the attribute panel in a storable format
    // disabled and tooltip are attributes of the parent element (li)
    // disabled actually means visibility:hidden
    function saveAttributePanel() {
        var panelcfg = {
            name: {},
            color1: {},
            color2: {},
            size: {}
        };

        var field = gid("attribute-name");
        panelcfg.name.value = field.value;
        panelcfg.name.disabled = field.parentElement.classList.contains("invisible");

        field = gid("attribute-color1");
        panelcfg.color1.value = field.value;
        panelcfg.color1.disabled = field.parentElement.classList.contains("invisible");
        panelcfg.color1.tooltip = field.parentElement.getAttribute("data-tooltip");

        field = gid("attribute-color2");
        panelcfg.color2.value = field.value;
        panelcfg.color2.disabled = field.parentElement.classList.contains("invisible");
        panelcfg.color2.tooltip = field.parentElement.getAttribute("data-tooltip");

        field = gid("attribute-size");
        panelcfg.size.value = field.value;
        panelcfg.size.disabled = field.parentElement.classList.contains("invisible");
        panelcfg.size.min = field.getAttribute("min");
        panelcfg.size.max = field.getAttribute("max");

        return panelcfg;
    }

    // restore the content of the attribute panel from a previous config
    // disabled actually means visibility:hidden
    function setupAttributePanel(panelcfg) {
        if (panelcfg.name) {
            var field = gid("attribute-name");

            if (panelcfg.name.value) {
                field.value = panelcfg.name.value;
            } else {
                field.value = "";
            }

            if (panelcfg.name.disabled) {
                field.parentElement.classList.add("invisible");
            } else {
                field.parentElement.classList.remove("invisible");
            }
        }

        if (panelcfg.color1) {
            var field = gid("attribute-color1");

            if (panelcfg.color1.value) {
                field.value = panelcfg.color1.value;
            } else {
                field.value = "";
            }

            if (panelcfg.color1.disabled) {
                field.parentElement.classList.add("invisible");
            } else {
                field.parentElement.classList.remove("invisible");
            }

            if (panelcfg.color1.tooltip) {
                field.parentElement.setAttribute("data-tooltip", panelcfg.color1.tooltip);
            } else {
                field.parentElement.removeAttribute("data-tooltip");
            }
        }

        if (panelcfg.color2) {
            var field = gid("attribute-color2");

            if (panelcfg.color2.value) {
                field.value = panelcfg.color2.value;
            } else {
                field.value = "";
            }

            if (panelcfg.color2.disabled) {
                field.parentElement.classList.add("invisible");
            } else {
                field.parentElement.classList.remove("invisible");
            }

            if (panelcfg.color2.tooltip) {
                field.parentElement.setAttribute("data-tooltip", panelcfg.color2.tooltip);
            } else {
                field.parentElement.removeAttribute("data-tooltip");
            }
        }

        if (panelcfg.size) {
            var field = gid("attribute-size");

            // set min and max before value
            if (panelcfg.size.min) {
                field.setAttribute("min", panelcfg.size.min);
            }

            if (panelcfg.size.max) {
                field.setAttribute("max", panelcfg.size.max);
            }

            if (panelcfg.size.value) {
                field.value = panelcfg.size.value;
            } else {
                field.value = "";
            }

            if (panelcfg.size.disabled) {
                field.parentElement.classList.add("invisible");
            } else {
                field.parentElement.classList.remove("invisible");
            }

            // in edit mode, this is done via observeInt
            if (_mode == "add" || _mode == "line") {
                updateAttributeSizeTooltip();

                field.oninput = updateAttributeSizeTooltip;
            }
        }
    }

    // set of popup listeners (open and close button)
    function setupPopup(id) {
        gid("button-" + id).addEventListener("click", e => {
            e.preventDefault();
            openPopup(id);
        });

        gid("close-" + id + "-popup").addEventListener("click", e => {
            e.preventDefault();
            closePopup(id);
        });
    }

    // close a popup by id
    function closePopup(id) {
        gid("popup-" + id).style.display = "none";
    }

    // close all popups
    function closePopups() {
        closePopup("canvas");
        closePopup("save");
        closePopup("background");
        closePopup("random");
        closePopup("info");
    }

    // open a popup by id
    function openPopup(id) {
        resetMode();

        closePopups();

        gid("popup-" + id).style.display = "block";

        document.activeElement.blur();
    }

    setupPopup("canvas");
    setupPopup("save");
    setupPopup("background");
    setupPopup("random");
    setupPopup("info");

    // update the "number of stars" label once after loading
    gid("new-num-stars-label").innerHTML = gid("new-num-stars").value;

    // set up listener for "number of stars" label
    gid("new-num-stars").oninput = () => {
        gid("new-num-stars-label").innerHTML = gid("new-num-stars").value;
    };

    // clear all elements and backgrounds from the canvas
    // if keepBackground is true, don't delete it
    function clearCanvas(keepBackground) {
        // remove with getObject() instead of clear(), this keeps the background image
        canvas.remove(...canvas.getObjects());

        if (!keepBackground) {
            canvas.backgroundColor = "#000000";
            canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
            gid("background-color").value = "#000000";
        }

        _stars = new Map();
        _lines = new Map();
        _texts = new Map();
        updateCounters();
    }

    // add X stars to the canvas
    // if newCanvas is true, clear the canvas first
    function addStarsToCanvas(newCanvas) {
        gid("new-canvas-create").setAttribute("aria-busy", true);

        canvas.renderOnAddRemove = false;

        if (newCanvas) {
            clearCanvas(gid("new-keep-bg").checked);
        }

        for (var i = 0; i < gid("new-num-stars").value; i++) {
            canvas.add(makeRandomStar());
        }

        updateCounters();
        gid("new-canvas-create").removeAttribute("aria-busy");

        if (newCanvas) {
            closePopup("canvas");
        }

        canvas.renderOnAddRemove = true;
        canvas.requestRenderAll();
    }

    // load the concents from a input[type=file] into the canvas
    // must be a valid *.json file
    async function loadFromFile(file) {
        gid("canvas-json-file-label").setAttribute("aria-busy", true);

        canvas.renderOnAddRemove = false;

        var data = await file.text();

        if (data != undefined && data != '' && file.name.split(".").pop().toLowerCase() == "json") {
            _stars = new Map();
            _lines = new Map();
            _texts = new Map();

            // third param is a function (j, o) that is called for each added object
            // j is the json, o is the fabric.Object
            // we use this for the additional setup for stars and lines
            canvas.loadFromJSON(data, canvas.renderAll.bind(canvas), (j, o) => {
                if (o.type == "circle") {
                    setupStar(o);
                } else if (o.type == "line") {
                    setupLine(o, false); // don't make neighbors known yet
                } else if (o.type == "text") {
                    setupText(o);
                }
            });

            // not all stars are set up at setupLine, so we need to make the neighbors known afterwards
            canvas.getObjects("line").forEach(line => {
                setupNeighbors(line);
            });

            canvas.getObjects("circle").forEach(star => {
                // for some reason, x{1,2} and y{1,2} are not correctly serialized
                // as a workaround, we update the line coordinates here
                updateLines(star);
            });

            closePopup("canvas");
            updateCounters();
            canvas.renderAll();
        }

        gid("canvas-json-file-label").removeAttribute("aria-busy");

        canvas.renderOnAddRemove = true;
    }

    // popup canvas: button "New Canvas"
    gid("new-canvas-create").addEventListener("click", e => {
        e.preventDefault();

        addStarsToCanvas(true);
    });

    // popup canvas: button "Add to Canvas"
    gid("new-canvas-add").addEventListener("click", e => {
        e.preventDefault();

        addStarsToCanvas(false);
    });

    // popup canvas: button "Clear Lines"
    gid("new-canvas-delete-lines").addEventListener("click", e => {
        e.preventDefault();

        deleteAllLines();
    });

    // popup canvas: button "Clear Canvas"
    gid("new-canvas-delete").addEventListener("click", e => {
        e.preventDefault();

        clearCanvas(false);
    });

    // load from while when file is selected
    gid("canvas-json-file").onchange = () => {
        loadFromFile(gid("canvas-json-file").files[0]);
    };

    // helper function to trigger a download of a generated blob
    // by adding a link to the document  and clicking it
    function triggerDownload(name, url) {
        var link = document.createElement('a');
        link.download = name;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // popup save: button "Export as PNG"
    gid("export-png").addEventListener("click", e => {
        var dataURL = canvas.toDataURL({
             width: canvas.width,
             height: canvas.height,
             left: 0,
             top: 0,
             format: 'png'
        });

        triggerDownload("image.png", dataURL);
    });

    // popup save: button "Export as SVG"
    gid("export-svg").addEventListener("click", e => {
        var dataURL = canvas.toSVG({
             width: canvas.width,
             height: canvas.height
        });

        var blob = new Blob([dataURL], {type: "image/svg+xml;charset=utf-8"});
        var localURL = URL.createObjectURL(blob);

        triggerDownload("image.svg", localURL);
    });

    // popup save: button "Export as JSON"
    gid("export-json").addEventListener("click", e => {
        var data =  JSON.stringify(canvas);

        var blob = new Blob([data], {type: "application/json;charset=utf-8"});
        var localURL = URL.createObjectURL(blob);

        triggerDownload("stars.json", localURL);
    });

    // popup background: button "Delete Background"
    gid("button-delete-background").addEventListener("click", e => {
        e.preventDefault();

        canvas.backgroundColor = "#000000";
        canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
        gid("background-color").value = "#000000";

        closePopup("background");
    });

    // change background color when a color is selected
    gid("background-color").oninput = () => {
        canvas.backgroundColor = gid("background-color").value;
        canvas.requestRenderAll();
    };

    // set the opacity label once after loading
    gid("background-opacity-label").innerHTML = gid("background-opacity").value;

    // change background image opacity when the slider is moved
    gid("background-opacity").oninput = () => {
        var opacity = parseInt(gid("background-opacity").value, 10);
        // update the label too
        gid("background-opacity-label").innerHTML = opacity;

        if (canvas.backgroundImage) {
            canvas.backgroundImage.set("opacity", opacity / 100.0);
            canvas.renderAll();
        }
    }

    // load an image from a URL and set it as the background image of the canvas
    function loadBackground(url, button_id) {
        var b = gid(button_id);
        b.setAttribute("aria-busy", true);

        fabric.Image.fromURL(url, imgObj => {
            var opts = { opacity: gid("background-opacity").value / 100.0,
                         originX: 'left',
                         originY: 'top',
                         crossOrigin: true }; // crossOrigin needed, so it can be saved/loaded

            // fit image to canvas if wanted
            if (gid("background-stretch").checked) {
                opts.scaleX = canvas.width / imgObj.width;
                opts.scaleY = canvas.height / imgObj.height;
            }

            canvas.setBackgroundImage(imgObj, canvas.renderAll.bind(canvas), opts);

            b.removeAttribute("aria-busy");
        }, { crossOrigin: true }); // crossOrigin needed, so image can be saved/loaded
    }

    // popup background: button "Load Image"
    // load a background image from a custom url
    gid("button-url-background").addEventListener("click", e => {
        var v = gid("background-url").value;

        if (v && v != "") {
            loadBackground(v, "button-url-background");
        }
    });

    // set up click listeners for all premade images
    var images = document.getElementsByClassName("background-gallery-image");
    for (var i = 0; i < images.length; i++) {
        images[i].addEventListener("click", e => {
            // remove /thumb from the URL and load image
            var url = e.target.src.replace(/\/thumb/, "");
            loadBackground(url, "premade-background-spinner");
        });
    }

    // popup info: Checkbox "Use Star Shadows"
    gid("use-shadows").oninput = () => {
        if (gid("use-shadows").checked) {
            _stars.forEach(star => {
                star.shadow = new fabric.Shadow({
                    color: star.fill,
                    blur: 10,
                    includeDefaultValues: false // less export when saving as JSON
                });
            });
        } else {
            _stars.forEach(star => {
                star.shadow = null;
            });
        }

        canvas.renderAll();
    }

    // popup info: Checkbox "Enable precise Selection"
    gid("toggle-per-pixel").oninput = () => {
        canvas.perPixelTargetFind = gid("toggle-per-pixel").checked;
        // drop currently selected object
        canvas.discardActiveObject();
        canvas.requestRenderAll();
    }

    // find a suitable first star to begin a constellation
    function findConstellationStart() {
        // filter out all stars that already have neighbors
        var starArray = Array.from(_stars.values()).filter(s => s.neighbors.size == 0);

        if (starArray.length == 0) {
            return null;
        }

        var candidate;
        var maxTries = 10;

        for (var i = 0; i < maxTries; i++) {
            // random star from candidates
            candidate = starArray[rando(0, starArray.length - 1)];

            // must have at least one partner to be considered a good starting point
            if (generateCandidateList(candidate, []).length == 0) {
                continue;
            }

            return candidate;
        }
    }

    // find a suitable starting star among the members of a constellation
    function findNextConstellationStart(members) {
        var maxNeighbors = parseInt(gid("cluster-max-neighbors").value, 10);
        var maxTries = 10;
        var candidate;

        if (members.length == 0) {
            return null;
        }

        // try to find a next start node
        for (var i = 0; i < maxTries; i++) {
            // choose next start node from current cluster
            candidate = _stars.get(members[rando(0, members.length - 1)]);

            // don't choose stars with many neighbors
            if (candidate.neighbors.size < maxNeighbors) {
                return candidate;
            }
        }

        return null;
    }

    // generate an array of suitable candidates to add a connection to
    // iterates through all nodes and filters our unsuitable nodes based on
    // distance, neighbors and other factors
    function generateCandidateList(origin, members) {
        var minDist = parseInt(gid("cluster-min-dist").value, 10);
        var maxDist = parseInt(gid("cluster-max-dist").value, 10);
        var maxNeighbors = parseInt(gid("cluster-max-neighbors").value, 10);
        var minStarSize = parseInt(gid("cluster-min-size").value, 10);

        var distances = new Array();

        _stars.forEach((star, uuid) => {
            // don't calculate distance to self
            if (uuid == origin.uuid) {
                return;
            }

            // drop direct neighbors
            if (starsAreConnected(origin, star)) {
                return;
            }

            if (members.indexOf(uuid) != -1) {
                // drop members with too many connections
                if (star.neighbors.size > maxNeighbors) {
                    return;
                }

                // drop members with 50% chance (more chance for new member)
                if (rando(0, 1) == 0) {
                    return;
                }
            } else {
                // don't connect to other constellations
                if (star.neighbors.size > 0) {
                    return;
                }
            }

            // drop small stars
            if (star.radius < minStarSize) {
                return;
            }

            // distance between the two center points in pixels
            var distance = origin.getCenterPoint().distanceFrom(star.getCenterPoint());

            // drop stars that are not in the habitable zone
            if (distance < minDist || distance > maxDist) {
                return;
            }

            distances.push([uuid, distance]);
        });

        // sort by distance, smallest first
        distances.sort((a, b) => {
            return a[1] - b[1];
        });

        return distances;
    }

    // generate a single constellation on the current canvas
    function generateConstellation() {
        var members = new Array();
        var lastStart = null;
        // initial starting node
        var start = findConstellationStart();

        var minMembers = parseInt(gid("cluster-min-members").value, 10);
        var maxMembers = parseInt(gid("cluster-max-members").value, 10);

        var wantedMembers = rando(minMembers, maxMembers);

        // we might not actually end up with wantedMembers
        for (var run = 0; run < wantedMembers; run++) {
            if (run != 0) {
                // choose next start node from current cluster
                start = findNextConstellationStart(members);

                // if we would start at the last start again, draw once more
                // does not completely prevent the "star-topology" issue, but should mitigate it enough
                if (start == lastStart) {
                    start = findNextConstellationStart(members);
                }
            }

            // no suitable start node, try again next round
            if (!start) {
                continue;
            }

            candidates = generateCandidateList(start, members);

            // no suitable candidates, try again next round
            if (candidates.length == 0) {
                continue;
            }

            // pull random star from candidate list and draw the line
            var partner = _stars.get(candidates[rando(0, candidates.length - 1)][0]);

            var opts = {
                size: parseInt(gid("cluster-line-width").value, 10),
                color: gid("cluster-line-color").value
            };
            var line = makeLine(start, partner, opts);
            canvas.add(line);
            canvas.sendToBack(line);

            if (members.indexOf(start.uuid) == -1) {
                members.push(start.uuid);
            }

            if (members.indexOf(partner.uuid) == -1) {
                members.push(partner.uuid);
            }

            lastStart = start;
        }
    }

    // generate (at max) num constellations on the current canvas
    function generateConstellations(num) {
        // nothing to generate
        if (_stars.size < 2) {
            return;
        }

        canvas.renderOnAddRemove = false;

        for (var i = 0; i < num; i++) {
            generateConstellation();
        }

        canvas.renderAll();

        canvas.renderOnAddRemove = true;
    }

    // update the "Line Thickness" label once after loading
    gid("cluster-line-width-label").innerHTML = gid("cluster-line-width").value;

    // set up listener for "Line Thickness" label
    gid("cluster-line-width").oninput = () => {
        gid("cluster-line-width-label").innerHTML = gid("cluster-line-width").value;
    };

    // update the "Min Star Size" label once after loading
    gid("cluster-min-size-label").innerHTML = gid("cluster-min-size").value;

    // set up listener for "Min Star Size" label
    gid("cluster-min-size").oninput = () => {
        gid("cluster-min-size-label").innerHTML = gid("cluster-min-size").value;
    };

    // popup random: Button "Replace Old"
    gid("cluster-new-canvas").addEventListener("click", e => {
        e.preventDefault();

        deleteAllLines();

        generateConstellations(gid("cluster-num-clusters").value);
    });

    // popup random: Button "Add to Canvas"
    gid("cluster-add-canvas").addEventListener("click", e => {
        e.preventDefault();

        generateConstellations(gid("cluster-num-clusters").value);
    });

    // popup random: Button "Add Single Constellation"
    gid("cluster-single-cluster").addEventListener("click", e => {
        e.preventDefault();

        generateConstellations(1);
    });

    // update the counters shown in the info popup
    function updateCounters() {
        gid("num-stars").innerHTML = _stars.size;
        gid("num-lines").innerHTML = _lines.size;
        gid("num-texts").innerHTML = _texts.size;
    }

    // reset everything mode-related, to the next mode can start from a clean slate
    function resetMode() {
        // save current values of attribute panel, so it can be restored when reentering add mode
        if (_mode == "add") {
            _starAttributeCache = saveAttributePanel();
        }

        // save current values of attribute panel, so it can be restored when reentering line mode
        if (_mode == "line") {
            _lineAttributeCache = saveAttributePanel();
        }

        // save current values of attribute panel, so it can be restored when reentering text mode
        if (_mode == "text") {
            _textAttributeCache = saveAttributePanel();
        }

        _mode = null;

        gid("mode-star-add").classList.remove('active-mode');
        gid("mode-star-edit").classList.remove('active-mode');
        gid("mode-star-line").classList.remove('active-mode');
        gid("mode-star-text").classList.remove('active-mode');
        gid("mode-star-delete").classList.remove('active-mode');

        // discard canvas seletion
        canvas.discardActiveObject();

        // hide attribute panel
        gid("attribute-panel").style.visibility = "hidden";

        // reset all canvas listeners
        canvas.off("mouse:up");
        canvas.off("mouse:down");
        canvas.off("mouse:over");
        canvas.off("mouse:out");
        canvas.off("selection:created");
        canvas.off("before:selection:cleared");
        canvas.off("object:moving");

        _stars.forEach(star => {
            star.selectable = false;
            star.lockMovementX = false;
            star.lockMovementY = false;
        });

        _lines.forEach(line => {
            line.selectable = false;
            line.evented = false;
        });

        _texts.forEach(text => {
            text.selectable = false;
            text.evented = true;
            text.hasControls = false;
        });
    }

    // generic function to set a mode
    function setMode(mode) {
        closePopups();

        _mode = mode;
        gid("mode-star-" + mode).classList.add("active-mode");
    }

    // addMode is used to add Stars to the canvas
    // the look of the stars is controlled by the attribute panel
    function enterAddMode() {
        if (_mode != "add") {
            resetMode();
            setMode("add");

            // load stored attributes from last add Mode (or default for first time)
            setupAttributePanel(_starAttributeCache);
            gid("attribute-panel").style.visibility = "visible";

            canvas.on({
                "mouse:up" : makeStarFromEvent
            });

            canvas.requestRenderAll();
        }
    }

    // editMode is used to edit star or line properties or to move stars
    function enterEditMode() {
        if (_mode != "edit") {
            resetMode();
            setMode("edit");

            _stars.forEach(star => {
                star.selectable = true;
            });

            _lines.forEach(line => {
                line.evented = true;
                line.selectable = true;
            });

            _texts.forEach(text => {
                text.selectable = true;
                text.hasControls = true;
            });

            // save last move event for async rendering
            var lastMoveEvent;

            // async (?) frame method, so we don't render every frame while moving an object
            // call onStarMove with the stored move event
            function frame() {
                if (lastMoveEvent) {
                    onStarMove(lastMoveEvent);
                    fabric.util.requestAnimFrame(frame, canvas.getElement());
                    canvas.requestRenderAll();
                }
            }

            canvas.on({
                "selection:created": e => {
                    if (e.target) {
                        if (e.target.type == "circle") {
                            onStarSelect(e);
                        } else if (e.target.type == "line") {
                            onLineSelect(e);
                        } else if (e.target.type == "text") {
                            onTextSelect(e);
                        }
                    }
                },
                // :created is only called when nothing was previously selected
                // this way, the attributePanels are set up correctly when directly
                // switching from editing a star to a line (or vice versa)
                "selection:updated": e => {
                    if (e.target) {
                        if (e.target.type == "circle") {
                            onStarSelect(e);
                        } else if (e.target.type == "line") {
                            onLineSelect(e);
                        } else if (e.target.type == "text") {
                            onTextSelect(e);
                        }
                    }
                },
                // use before: so that we actually know which element the selection was cleared from
                "before:selection:cleared": e => {
                    if (e.target) {
                        if (e.target.type == "circle") {
                            onStarDeselect(e);
                        } else if (e.target.type == "line") {
                            onLineDeselect(e);
                        } else if (e.target.type == "text") {
                            onTextDeselect(e);
                        }
                    }
                },
                "mouse:up": e => {
                    // delete lastMoveEvent when the mouse is released,
                    // which stops frame from calling requestAnimFrame()
                    if (lastMoveEvent) {
                        onStarMove(lastMoveEvent);
                        canvas.requestRenderAll();
                    }
                    lastMoveEvent = null;
                },
                "object:moving": e => {
                    // need to call frame() if this is the first move event
                    var start = !lastMoveEvent;

                    if (e.target && e.target.type == "circle") {
                        lastMoveEvent = e;
                    }

                    // call frame after lastMoveEvent is set, so that frame() will go into recursion
                    if (start) {
                        frame();
                    }
                }
            });

            canvas.requestRenderAll();
        }
    }

    // lineMode is used to draw lines between stars
    // the look of the lines is controlled via the attribute panel
    function enterLineMode() {
        if (_mode != "line") {
            resetMode();
            setMode("line");

            setupAttributePanel(_lineAttributeCache);
            gid("attribute-panel").style.visibility = "visible";

            _texts.forEach(text => {
                text.evented = false;
            });

            canvas.on({
                "mouse:down": e => {
                    var tmpLine; // stores the line that is drawn from the start to the cursor
                    var t2; // store thickness of the line (used for coordinate correction)
                    var mouse; // last known mouse position (for async rendering)
                    var startStar; // star which the temporary line is starting from

                    if (e.target && e.target.type == "circle") {
                        // if a star is clicked, create a temporary line that originates at the clicked
                        // star and runs to the mouse pointer
                        var center = e.target.getCenterPoint();
                        t2 = parseInt(gid("attribute-size").value, 10);
                        var x = center.x - t2;
                        var y = center.y - t2;
                        var coords = [x, y, x, y];
                        tmpLine = new fabric.Line(coords, {
                            evented: false,
                            selectable: false,
                            stroke: gid("attribute-color2").value,
                            strokeWidth: t2
                        });
                        canvas.add(tmpLine);
                        canvas.sendToBack(tmpLine);
                        startStar = e.target;
                        canvas.requestRenderAll();

                        mouse = e.absolutePointer;

                        frame();
                    }

                    // async (?) function that updates the temporary line to the last known mouse coordinates
                    function frame() {
                        if (tmpLine) {
                            tmpLine.set({ 'x2': mouse.x - t2, 'y2': mouse.y - t2 });
                            fabric.util.requestAnimFrame(frame, tmpLine);
                            canvas.requestRenderAll();
                        }
                    }

                    canvas.on({
                        // set the new endpoint of the line when moving the mouse
                        "mouse:move": e => {
                            // snap to the center if moving over a star
                            if (e.target && e.target.type == "circle") {
                                mouse = e.target.getCenterPoint();
                            } else { // use mouse position otherwise
                                mouse = e.absolutePointer;
                            }
                        },
                        "mouse:up": e => {
                            if (e.target && e.target.type == "circle" && e.target != startStar && !starsAreConnected(e.target, startStar) && tmpLine) {
                                // draw the real line if the mouse was released on another star, and the stars aren't connected yet
                                var opts = {
                                    size: parseInt(gid("attribute-size").value, 10),
                                    color: gid("attribute-color2").value
                                };

                                var realLine = makeLine(startStar, e.target, opts);
                                canvas.add(realLine);
                                canvas.sendToBack(realLine);

                            }

                            // delete the temporary line and reset state
                            // regardless of if a real line was drawn
                            canvas.remove(tmpLine);
                            tmpLine = null;
                            startStar = null;
                            mouse = null;
                            canvas.off("mouse:move");
                            canvas.off("mouse:up");
                            canvas.renderAll();
                        }
                    });
                }
            });

            canvas.requestRenderAll();
        }
    }

    // textMode can be used to place text on the canvas.
    // it also allows for editing the existing text fields, just like edit mode, because it feels intuitive that way.
    // the default text and colors are controlled by the attribute panel
    function enterTextMode() {
        if (_mode != "text") {
            resetMode();
            setMode("text");

            // load stored attributes from last text Mode (or default for first time)
            setupAttributePanel(_textAttributeCache);
            gid("attribute-panel").style.visibility = "visible";

            _texts.forEach(text => {
                text.selectable = true;
                text.hasControls = true;
            });

            // two flags, needed so that mouse:up does not call makeText when / just after deselecting an existing text
            var editing = false;
            var just_deselected = false;

            canvas.on({
                "mouse:up": e => {
                    if (!editing && !just_deselected) {
                        makeTextFromEvent(e);
                    }

                    // it an existing text field was just deselected, load the attribute panel from the cache
                    if (just_deselected) {
                        just_deselected = false;
                        setupAttributePanel(_textAttributeCache);
                    }
                },
                "selection:created": e => {
                    if (e.target && e.target.type == "text") {
                        _textAttributeCache = saveAttributePanel();
                        editing = true;
                        onTextSelect(e);
                    }
                },
                // :created is only called when nothing was previously selected
                // this way, the attributePanels are set up correctly when directly
                // switching from editing a star to a line (or vice versa)
                "selection:updated": e => {
                    if (e.target && e.target.type == "text") {
                        editing = true;
                        onTextSelect(e);
                    }
                },
                // use before: so that we actually know which element the selection was cleared from
                "before:selection:cleared": e => {
                    if (e.target && e.target.type == "text") {
                        onTextDeselect(e, true); // true means don't hide the panel, as it will display the default settings next
                        editing = false;
                        just_deselected = true;
                    }
                },
            });

            canvas.requestRenderAll();
        }
    }

    // deleteMode is used to delete stars and lines
    function enterDeleteMode() {
        if (_mode != "delete") {
            resetMode();
            setMode("delete");

            _stars.forEach(star => {
                star.selectable = true;
            });

            _lines.forEach(line => {
                line.evented = true;
                line.selectable = true;
            });

            _texts.forEach(text => {
                text.selectable = true;
            });

            // async (?) function renders the hover effects for objects
            function frame() {
                if (_mode == "delete") {
                    fabric.util.requestAnimFrame(frame, canvas.getElement());
                    canvas.requestRenderAll();
                }
            }

            canvas.on({
                "selection:created": e => {
                    if (e.target) {
                        if (e.target.type == "circle") {
                            deleteStarEvent(e);
                        } else if (e.target.type == "line") {
                            deleteLineEvent(e);
                        } else if (e.target.type == "text") {
                            deleteTextEvent(e);
                        }
                    }
                },
                "mouse:over": e => {
                    if (e.target) {
                        e.target.set("backgroundColor", "#ff0000");
                    }
                },
                "mouse:out": e => {
                    if (e.target) {
                        e.target.set("backgroundColor", null);
                    }
                }
            });

            canvas.requestRenderAll();

            frame();
        }
    }

    // generate a somewhat random uuid
    // generously taken from stackoverflow
    function uuidv4() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }

    // the name says it all
    function updateAttributeSizeTooltip() {
        gid("attribute-size-label").setAttribute("data-tooltip", "Size: " + gid("attribute-size").value);
    }

    // setup and show attribute panel when a star was clicked in edit mode
    function onStarSelect(e) {
        // load "default" attributes for stars, values will be overridden by observe()
        setupAttributePanel(_starAttributeCache);

        observe(e.target, "attribute-name", "name")
        observe(e.target, "attribute-color1", "fill", () => {
            // update shadow color too, if present
            if (e.target.shadow) {
                e.target.shadow.color = gid("attribute-color1").value;
            }
        });
        observe(e.target, "attribute-color2", "stroke");
        observeInt(e.target, "attribute-size", "radius", (oldVal) => {
            // move center so that the circle expands "outwards" instead of "down right"
            var diff = e.target.radius - oldVal;
            e.target.left = e.target.left - diff;
            e.target.top = e.target.top - diff;

            // recalculate line centers when changing size
            updateLines(e.target);
            updateAttributeSizeTooltip();
            canvas.requestRenderAll();
        });
        updateAttributeSizeTooltip();
        gid("attribute-panel").style.visibility = "visible";
    }

    // hide and deactivate attribute panel when a star was deselected in edit mode
    function onStarDeselect(e) {
        gid("attribute-panel").style.visibility = "hidden";
        unobserve("attribute-name");
        unobserve("attribute-color1");
        unobserve("attribute-color2");
        unobserve("attribute-size");
    }

    // update a line start and end points (from the lines perspective)
    function recalculateLinePoints(line) {
        var from = _stars.get(line.from).getCenterPoint();
        var to = _stars.get(line.to).getCenterPoint();
        var t2 = line.strokeWidth / 2;

        line.set({ 'x1': from.x - t2, 'y1': from.y - t2 });
        line.set({ 'x2': to.x - t2, 'y2': to.y - t2 });

        canvas.renderAll();
    }

    // setup and show attribute panel when a line was clicked in edit mode
    function onLineSelect(e) {
        // load "default" attributes for lines, values will be overridden by observe()
        setupAttributePanel(_lineAttributeCache);

        observe(e.target, "attribute-color2", "stroke");
        observeInt(e.target, "attribute-size", "strokeWidth", () => {
            // update the line coordinates when chaging size
            recalculateLinePoints(e.target);
            updateAttributeSizeTooltip();
        });

        updateAttributeSizeTooltip();
        gid("attribute-panel").style.visibility = "visible";
    }

    // hide and deactivate attribute panel when a line was deselected in edit mode
    function onLineDeselect(e) {
        gid("attribute-panel").style.visibility = "hidden";
        unobserve("attribute-color2");
        unobserve("attribute-size");
    }

    // set up the attribute panel to edit the attribute of text fields in edit mode
    function onTextSelect(e) {
        // load "default" attributes for lines, values will be overridden by observe()
        setupAttributePanel(_textAttributeCache);

        observe(e.target, "attribute-name", "text");
        observe(e.target, "attribute-color1", "fill");
        observe(e.target, "attribute-color2", "stroke");

        gid("attribute-panel").style.visibility = "visible";
    }

    // hide the attribute panel when a text field was deselected in edit mode
    // if dontHide is true, don't hide the attribute panel
    function onTextDeselect(e, dontHide) {
        if (!dontHide) {
            gid("attribute-panel").style.visibility = "hidden";
        }

        unobserve("attribute-name");
        unobserve("attribute-color1");
        unobserve("attribute-color2");

        // delete text field if it is empty after editing
        if (e.target.text == "") {
            deleteTextEvent(e);
            canvas.requestRenderAll();
        }
    }

    // update the coordinates of all lines originating or running to this star
    function onStarMove(e) {
        updateLines(e.transform.target);
    }

    // delete a star from the canvas and internal data structures
    function deleteStarEvent(e) {
        var star = e.target;

        // copy so that we can remove values while iterating
        var lines_from_copy = new Set(star.lines_from);
        lines_from_copy.forEach(uuid => {
            deleteLine(uuid);
        });

        // copy so that we can remove values while iterating
        var lines_to_copy = new Set(star.lines_to);
        lines_to_copy.forEach(uuid => {
            deleteLine(uuid);
        });

        _stars.delete(star.uuid);
        canvas.remove(star);

        updateCounters();
    }

    // does what it says
    function deleteAllLines() {
        var oldval = canvas.renderOnAddRemove;
        canvas.renderOnAddRemove = false;

        // don't iterate over _lines, because we would delete elements from it while iterating
        var lines = canvas.getObjects("line");
        lines.forEach(line => {
            deleteLine(line.uuid);
        });

        updateCounters();
        canvas.renderAll();
        canvas.renderOnAddRemove = oldval;
    }

    // delete a clicked line
    function deleteLineEvent(e) {
        deleteLine(e.target.uuid);
        updateCounters();
    }

    // delete a line by uuid from the canvas and internal data structures
    function deleteLine(uuid) {
        var line = _lines.get(uuid);

        var from = _stars.get(line.from);
        var to = _stars.get(line.to);

        from.lines_from.delete(uuid);
        from.neighbors.delete(to.uuid);

        to.lines_to.delete(uuid);
        to.neighbors.delete(from.uuid);

        _lines.delete(line.uuid);
        canvas.remove(line);
    }

    // update the coordinate of all lines originating from or running to a star
    function updateLines(e) {
        var c = e.getCenterPoint();

        e.lines_from.forEach(uuid => {
            var l = _lines.get(uuid);
            var t2 = l.strokeWidth / 2;
            l.set({ 'x1': c.x - t2, 'y1': c.y - t2 });
            l.setCoords();
        });

        e.lines_to.forEach(uuid => {
            var l = _lines.get(uuid);
            var t2 = l.strokeWidth / 2;
            l.set({ 'x2': c.x - t2, 'y2': c.y - t2 });
            l.setCoords();
        });
    }

    // delete a clicked line
    function deleteTextEvent(e) {
        _texts.delete(e.target.uuid);
        canvas.remove(e.target);

        updateCounters();
    }

    // observe an input field and tie it to a property of a fabric.Object
    // if set, func will be executed after the element property is set
    function observe(elem, id, property, func) {
        // get the input field
        var el = gid(id);

        // set the initial value of the input field to the element property
        el.value = elem[property];

        // set the element property if the input field is changed
        el.oninput = function() {
            elem.set(property, this.value);
            elem.setCoords();

            if (func) {
                func();
            }

            canvas.renderAll();
        }
    }

    // observe an input field and tie it to a property of a fabric.Object, while casting the value to Int
    // if set, func will be executed after the element property is set, with the oldVal as a parameter
    function observeInt(elem, id, property, func) {
        // get the input field
        var el = gid(id);

        // set the initial value of the input field to the element property
        el.value = elem[property];

        // set the element property if the input field is changed
        el.oninput = function() {
            var oldVal = elem.get(property);

            elem.set(property, parseInt(this.value, 10));
            elem.setCoords();

            if (func) {
                func(oldVal);
            }

            canvas.renderAll();
        }
    }

    // remove the oninput function from an input field
    function unobserve(id) {
        gid(id).oninput = function(){};
    }

    // return true if two stars have a line between them
    function starsAreConnected(s1, s2) {
        return s1.neighbors.has(s2.uuid);
    }

    // set up additional star attributes
    // this function is called for each new star, as well as all stars that are loaded
    function setupStar(star) {
        // sensible defaults
        star.hasControls = false;
        star.selectable = false;
        star.hasRotatingPoint = false;

        // add name, uuid, lines_from and lines_to to JSON export
        star.toObject = (function(toObject) {
          return function() {
            return fabric.util.object.extend(toObject.call(this), {
              name: this.name,
              uuid: this.uuid,
              lines_from: [...this.lines_from], // must export Set as Array
              lines_to: [...this.lines_to] // must export Set as Array
            });
          };
        })(star.toObject);

        // convert Array to Set for stars loaded from JSON
        star.lines_from = new Set(star.lines_from);
        star.lines_to = new Set(star.lines_to);

        // keep track of neighbors, aka stars we have a line to; not exported to JSON
        star.neighbors = new Set();

        // add to global map
        _stars.set(star.uuid, star);
    }

    // make and return a new star according to coordinats [left, top] and additional opts
    // this function is only called for newly added stars
    function makeStar(left, top, opts) {
        var size = ("size" in opts ? opts.size : STAR_DEFAULT_SIZE);
        var fill = ("fill" in opts ? opts.fill : "#ffffff");
        var stroke = ("stroke" in opts ? opts.stroke : "#cccccc");
        var name = ("name" in opts ? opts.name : "Unnamed star");

        // string might be empty
        if (!name) {
            name = "Unnamed star";
        }

        var star = new fabric.Circle({
            left: left,
            top: top,
            strokeWidth: 2,
            radius: size,
            fill: fill,
            stroke: stroke,
            padding: 5,
            includeDefaultValues: false, // less export when saving to JSON
        });

        if (gid("use-shadows").checked) {
            star.shadow = new fabric.Shadow({
                color: fill,
                blur: 10,
                includeDefaultValues: false
            });
        }

        star.name = name;
        star.uuid = uuidv4();

        star.lines_from = new Set();
        star.lines_to = new Set();

        setupStar(star);

        updateCounters();

        return star;
    }

    // make neighbors known to each other
    function setupNeighbors(line) {
        _stars.get(line.from).neighbors.add(line.to);
        _stars.get(line.to).neighbors.add(line.from);
    }

    // set up additional line attributes
    // this function is called for each new line, as well as all lines that are loaded
    // it setNeighbors is true, the stars will be made aware of each other via their neighbors set
    function setupLine(line, setNeighbors=true) {
        // sensible defaults
        line.selectable = false;
        line.evented = false;
        line.lockMovementX = true;
        line.lockMovementY = true;
        line.hasControls = false;
        line.hasRotatingPoint = false;

        // add uuid, from and to to JSON export
        line.toObject = (function(toObject) {
          return function() {
            return fabric.util.object.extend(toObject.call(this), {
              uuid: this.uuid,
              from: this.from,
              to: this.to
            });
          };
        })(line.toObject);

        // optional, not all stars are in the map yet when loading from JSON
        if (setNeighbors) {
            setupNeighbors(line);
        }

        // add to global map
        _lines.set(line.uuid, line);
    }

    // make and return a line from one star to another
    // only called for new lines
    function makeLine(from, to, opts) {
        var stroke = ("color" in opts ? opts.color : "#ffffff");
        var thickness = ("size" in opts ? opts.size : LINE_DEFAULT_SIZE);

        var t2 = thickness / 2;
        var c1 = from.getCenterPoint();
        var c2 = to.getCenterPoint();
        // correct coords by half of line width
        var coords = [c1.x - t2, c1.y - t2, c2.x - t2, c2.y - t2];
        var line = new fabric.Line(coords, {
            stroke: stroke,
            strokeWidth: thickness,
            includeDefaultValues: false // less data when saving to JSON
        });

        line.uuid = uuidv4();

        line.from = from.uuid;
        line.to = to.uuid;

        // add uuid to respective stars
        from.lines_from.add(line.uuid);
        to.lines_to.add(line.uuid);

        setupLine(line, true);

        updateCounters();

        return line;
    }

    // set up the text attributes
    // this function is called for each new text field, as well as text fields loaded from JSON
    function setupText(text) {
        // start with selectable = true because we allow editing in text mode too
        text.selectable = true;
        text.hasControls = true;

        // hide the non-edge controls, so that font can only be grown/shrunk proportionally
        text.setControlVisible("ml", false);
        text.setControlVisible("mt", false);
        text.setControlVisible("mr", false);
        text.setControlVisible("mb", false);

        // add uuid to JSON export
        text.toObject = (function(toObject) {
          return function() {
            return fabric.util.object.extend(toObject.call(this), {
              uuid: this.uuid,
            });
          };
        })(text.toObject);

        // add to global map
        _texts.set(text.uuid, text);
    }

    // make and return a text field
    // only called for new text fields
    function makeText(left, top, opts) {
        var text = gid("attribute-name").value;
        if (!text || text == "") {
            text = "Text";
        }

        var fill = ("fill" in opts ? opts.fill : "#ffffff");
        var stroke = ("stroke" in opts ? opts.stroke : "#ffffff");

        var text = new fabric.Text(text, {
            left: left,
            top: top,
            fill: fill,
            stroke: stroke,
            strokeWidth: 1,
            includeDefaultValues: false
        });

        text.uuid = uuidv4();

        setupText(text);

        updateCounters();

        return text;
    }

    // return a randomly generated star, according to the settings in the canvas popup
    function makeRandomStar() {
        var min = parseInt(gid("new-min-size").value, 10);
        var max = parseInt(gid("new-max-size").value, 10);
        var innerC = gid("new-inner-color").value;
        var outerC = gid("new-outer-color").value;

        var opts = {
            size: rando(min, max),
            fill: innerC,
            stroke: outerC
        };

        // PADDING should prevent stars from clipping outside of the canvas
        return makeStar(rando(PADDING, CANVAS_WIDTH-PADDING), rando(PADDING, CANVAS_HEIGHT-PADDING), opts);
    }

    // create a star at the position of a click event
    function makeStarFromEvent(e) {
        if (e.target == null || e.target == undefined) {
            var opts = {
                size: gid("attribute-size").value,
                fill: gid("attribute-color1").value,
                stroke: gid("attribute-color2").value,
                name: gid("attribute-name").value
            };

            var x = e.absolutePointer.x - opts.size - 1;
            var y = e.absolutePointer.y - opts.size - 1;

            canvas.add(makeStar(x, y, opts));
        }
    }

    // create a text element at the position of a click event
    function makeTextFromEvent(e) {
        if (e.target == null || e.target == undefined) {
            var opts = {
                fill: gid("attribute-color1").value,
                stroke: gid("attribute-color2").value,
            };

            var x = e.absolutePointer.x;
            var y = e.absolutePointer.y;

            canvas.add(makeText(x, y, opts));
        }
    }

    // initialize the canvas with some defaults
    var canvas = this.__canvas = new fabric.Canvas('star-map', {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#000000',
        selection: false,
        perPixelTargetFind: gid("toggle-per-pixel").checked
    });

    // finally: open canvas popup
    gid("button-canvas").click();
})();