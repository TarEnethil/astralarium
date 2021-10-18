(function() {
    var gid = function(id) { return document.getElementById(id); };

    var CANVAS_WIDTH = window.innerWidth;
    var CANVAS_HEIGHT = window.innerHeight - gid("nav").clientHeight;
    var PADDING = 20;

    var STAR_DEFAULT_SIZE = 4;
    var STAR_MIN_SIZE = 2;
    var STAR_MAX_SIZE = 9;
    var LINE_DEFAULT_SIZE = 1;
    var LINE_MIN_SIZE = 1;
    var LINE_MAX_SIZE = 5;

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

    var _lineAttributeCache = {
        name: {
            value: "disabled",
            disabled: true
        },
        color1: {
            value: "#ffffff",
            disabled: false,
            tooltip: "Line Color"
        },
        color2: {
            value: "#cccccc",
            disabled: true,
            tooltip: "disabled"
        },
        size: {
            value: LINE_DEFAULT_SIZE,
            disabled: false,
            min: LINE_MIN_SIZE,
            max: LINE_MAX_SIZE
        }
    };

    rando = fabric.util.getRandomInt;

    var _stars = new Map();
    var _lines = new Map();

    var _lastObject;
    var _pickingTo = false;

    var _mode;

    document.addEventListener('keyup', e => {
        if (e.key == 'n') {
            gid("button-canvas").click();
        } else if (e.key == 's') {
            gid("button-save").click();
        } else if (e.key == 'b') {
            gid("button-background").click();
        } else if (e.key == 'h') {
            gid("button-info").click();
        } else if (e.key === 'i') {
            enterAddMode();
        } else if (e.key === 'e') {
            enterEditMode();
        } else if (e.key === 'l') {
            enterLineMode();
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

    gid("mode-star-add").addEventListener("click", e => {
        e.preventDefault();
        document.activeElement.blur();
        enterAddMode();
    });

    gid("mode-star-edit").addEventListener("click", e => {
        e.preventDefault();
        document.activeElement.blur();
        enterEditMode();
    });

    gid("mode-star-line").addEventListener("click", e => {
        e.preventDefault();
        document.activeElement.blur();
        enterLineMode();
    });

    gid("mode-star-delete").addEventListener("click", e => {
        e.preventDefault();
        document.activeElement.blur();
        enterDeleteMode();
    });

    function saveAttributePanel() {
        var panelcfg = {
            name: {},
            color1: {},
            color2: {},
            size: {}
        };

        var field = gid("attribute-name");
        panelcfg.name.value = field.value;
        panelcfg.name.disabled = field.getAttribute("disabled");

        field = gid("attribute-color1");
        panelcfg.color1.value = field.value;
        panelcfg.color1.disabled = field.getAttribute("disabled");
        panelcfg.color1.tooltip = field.parentElement.getAttribute("data-tooltip");

        field = gid("attribute-color2");
        panelcfg.color2.value = field.value;
        panelcfg.color2.disabled = field.getAttribute("disabled");
        panelcfg.color2.tooltip = field.parentElement.getAttribute("data-tooltip");

        field = gid("attribute-size");
        panelcfg.size.value = field.value;
        panelcfg.size.disabled = field.getAttribute("disabled");
        panelcfg.size.min = field.getAttribute("min");
        panelcfg.size.max = field.getAttribute("max");

        return panelcfg;
    }

    function setupAttributePanel(panelcfg) {
        if (panelcfg.name) {
            var field = gid("attribute-name");

            if (panelcfg.name.value) {
                field.value = panelcfg.name.value;
            } else {
                field.value = "";
            }

            if (panelcfg.name.disabled) {
                field.setAttribute("disabled", "disabled");
            } else {
                field.removeAttribute("disabled");
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
                field.setAttribute("disabled", "disabled");
            } else {
                field.removeAttribute("disabled");
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
                field.setAttribute("disabled", "disabled");
            } else {
                field.removeAttribute("disabled");
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
                field.setAttribute("disabled", "disabled");
            } else {
                field.removeAttribute("disabled");
            }

            // in edit mode, this is done via observeInt
            if (_mode == "add" || _mode == "line") {
                updateAttributeSizeTooltip();

                field.oninput = updateAttributeSizeTooltip;
            }
        }
    }

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

    function closePopup(id) {
        gid("popup-" + id).style.display = "none";
    }

    function closePopups() {
        closePopup("canvas");
        closePopup("save");
        closePopup("background");
        closePopup("info");
    }

    function openPopup(id) {
        resetMode();

        closePopup("canvas");
        closePopup("save");
        closePopup("background");
        closePopup("info");

        gid("popup-" + id).style.display = "block";

        document.activeElement.blur();
    }

    gid("new-num-stars-label").innerHTML = gid("new-num-stars").value;
    gid("new-num-stars").oninput = () => {
        gid("new-num-stars-label").innerHTML = gid("new-num-stars").value;
    };

    function clearCanvas() {
        canvas.clear();
        canvas.backgroundColor = "#000000";
        _stars = new Map();
        _lines = new Map();
        updateCounters();
    }

    function addStarsToCanvas(newCanvas) {
        gid("new-canvas-create").setAttribute("aria-busy", true);

        if (newCanvas) {
            clearCanvas();
        }

        for (var i = 0; i < gid("new-num-stars").value; i++) {
            canvas.add(makeRandomStar());
        }

        updateCounters();
        gid("new-canvas-create").removeAttribute("aria-busy");

        if (newCanvas) {
            closePopup("canvas");
        }
    }

    gid("new-canvas-create").addEventListener("click", e => {
        e.preventDefault();

        addStarsToCanvas(true);
    });

    gid("new-canvas-add").addEventListener("click", e => {
        e.preventDefault();

        addStarsToCanvas(false);
    });

    gid("new-canvas-delete").addEventListener("click", e => {
        e.preventDefault();

        clearCanvas();
    });

    gid("load-canvas-from-data").addEventListener("click", e => {
        gid("load-canvas-from-data").setAttribute("aria-busy", true);

        var data = gid("canvas-load-data").value;

        _stars = new Map();
        _lines = new Map();

        if (data != undefined && data != '') {
            canvas.loadFromJSON(data);

            canvas.getObjects("line").forEach(line => {
                setupLine(line);
            });

            canvas.getObjects("circle").forEach(star => {
                setupStar(star);

                // for some reason, x{1,2} and y{1,2} are not correctly serialized
                // as a workaround, we update the line coordinates here
                updateLines(star);
            });

            gid("load-canvas-from-data").removeAttribute("aria-busy");
            closePopup("canvas");
            updateCounters();
        }
    });

    function triggerDownload(name, url) {
        var link = document.createElement('a');
        link.download = name;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

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

    gid("export-svg").addEventListener("click", e => {
        var dataURL = canvas.toSVG({
             width: canvas.width,
             height: canvas.height
        });

        var blob = new Blob([dataURL], {type: "image/svg+xml;charset=utf-8"});
        var localURL = URL.createObjectURL(blob);

        triggerDownload("image.svg", localURL);
    });

    gid("export-json").addEventListener("click", e => {
        var data =  JSON.stringify(canvas);

        var blob = new Blob([data], {type: "application/json;charset=utf-8"});
        var localURL = URL.createObjectURL(blob);

        triggerDownload("stars.json", localURL);
    });

    gid("button-delete-background").addEventListener("click", e => {
        e.preventDefault();

        canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
        canvas.backgroundColor = "#000000";
        canvas.requestRenderAll();

        closePopup("background");
    });

    gid("background-color").oninput = () => {
        canvas.backgroundColor = gid("background-color").value;
        canvas.requestRenderAll();
        closePopup("background");
    };

    gid("button-url-background").addEventListener("click", e => {
        var v = gid("background-url").value;

        if (v && v != "") {
            loadBackground(v, "button-url-background");
        }
    });

    var images = document.getElementsByClassName("background-gallery-image");
    for (var i = 0; i < images.length; i++) {
        var url = images[i].src.replace(/\/thumb/, "");
        images[i].addEventListener("click", e => {
            loadBackground(url, "premade-background-spinner");
        });
    }

    setupPopup("canvas");
    setupPopup("save");
    setupPopup("background");
    setupPopup("info");

    function updateCounters() {
        gid("num-stars").innerHTML = _stars.size;
        gid("num-lines").innerHTML = _lines.size;
    }

    function loadBackground(url, button_id) {
        var b = gid(button_id);
        b.setAttribute("aria-busy", true);

        fabric.Image.fromURL(url, imgObj => {
            var opts = { opacity: 1,
                         originX: 'left',
                         originY: 'top',
                         crossOrigin: true };

            if (gid("background-stretch").checked) {
                opts.scaleX = canvas.width / imgObj.width;
                opts.scaleY = canvas.height / imgObj.height;
            }

            canvas.setBackgroundImage(imgObj, canvas.renderAll.bind(canvas), opts);

            b.removeAttribute("aria-busy");
            gid("popup-background").style.display = "none";
        }, { crossOrigin: true });
    }

    function resetMode() {
        // save current values of attribute panel, so it can be restored when reentering add mode
        if (_mode == "add") {
            _starAttributeCache = saveAttributePanel();
        }

        // save current values of attribute panel, so it can be restored when reentering line mode
        if (_mode == "line") {
            _lineAttributeCache = saveAttributePanel();
        }

        _mode = null;

        gid("mode-star-add").classList.remove('active-mode');
        gid("mode-star-edit").classList.remove('active-mode');
        gid("mode-star-line").classList.remove('active-mode');
        gid("mode-star-delete").classList.remove('active-mode');

        canvas.discardActiveObject();

        gid("attribute-panel").style.visibility = "hidden";

        _stars.forEach(star => {
            star.selectable = false;
            star.off({
                "selected": onStarSelect,
                "deselected": onStarDeselect,
                "moving": onStarMove
            });
            // off() does not seem to work with the same key twice?
            star.off({
                "selected": deleteStarEvent
            });
            star.lockMovementX = false;
            star.lockMovementY = false;
        });

        _lines.forEach(line => {
            line.evented = false;
            line.selectable = false;
            line.off({
                "selected": onLineSelect,
                "deselected": onLineDeselect
            });
            line.off({
                "selected": deleteLineEvent
            });
        });

        _pickingTo = false;
        _lastObject = null;

        canvas.off({
            "mouse:up" : makeStarFromEvent
        });
    }

    function setMode(mode) {
        closePopups();

        _mode = mode;
        gid("mode-star-" + mode).classList.add("active-mode");
    }

    function enterAddMode() {
        if (_mode != "add") {
            resetMode();
            setMode("add");

            setupAttributePanel(_starAttributeCache);
            gid("attribute-panel").style.visibility = "visible";

            canvas.on({
                "mouse:up" : makeStarFromEvent
            });

            canvas.requestRenderAll();
        }
    }

    function enterEditMode() {
        if (_mode != "edit") {
            resetMode();
            setMode("edit");

            _stars.forEach(star => {
                star.selectable = true;
                star.on({
                    "selected": onStarSelect,
                    "deselected": onStarDeselect,
                    "moving": onStarMove
                });
            });

            _lines.forEach(line => {
                line.evented = true;
                line.selectable = true;
                line.on({
                    "selected": onLineSelect,
                    "deselected": onLineDeselect
                });
            });

            canvas.requestRenderAll();
        }
    }

    function enterLineMode() {
        if (_mode != "line") {
            resetMode();
            setMode("line");

            setupAttributePanel(_lineAttributeCache);
            gid("attribute-panel").style.visibility = "visible";

            _stars.forEach(star => {
                star.selectable = true;
                star.on({
                    "selected": onStarSelect,
                    "deselected": onStarDeselect
                });
                star.lockMovementX = true;
                star.lockMovementY = true;
            });

            canvas.requestRenderAll();
        }
    }

    function enterDeleteMode() {
        if (_mode != "delete") {
            resetMode();
            setMode("delete");

            _stars.forEach(star => {
                star.selectable = true;
                star.on({
                    "selected": deleteStarEvent,
                });
            });

            _lines.forEach(line => {
                line.evented = true;
                line.selectable = true;
                line.on({
                    "selected": deleteLineEvent
                });
            });

            canvas.requestRenderAll();
        }
    }

    function uuidv4() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }

    function updateAttributeSizeTooltip() {
        gid("attribute-size-label").setAttribute("data-tooltip", "Size: " + gid("attribute-size").value);
    }

    function onStarSelect(e) {
        if (_mode == "edit") {
            var cfg = {
                name: {
                    disabled: false
                },
                color1: {
                    disabled: false,
                    tooltip: "Inner Star Color"
                },
                color2: {
                    disabled: false,
                    tooltip: "Outer Star Color",
                },
                size: {
                    disabled: false,
                    min: STAR_MIN_SIZE,
                    max: STAR_MAX_SIZE
                }
            };

            setupAttributePanel(cfg);

            observe(e.target, "attribute-name", "name")
            observe(e.target, "attribute-color1", "fill");
            observe(e.target, "attribute-color2", "stroke");
            observeInt(e.target, "attribute-size", "radius", () => {
                // recalculate line centers when changing size
                updateLines(e.target);
                updateAttributeSizeTooltip();
            });
            updateAttributeSizeTooltip();
            gid("attribute-panel").style.visibility = "visible";
        }

        if (_mode == "line") {
            if (_pickingTo) {
                var line = makeLine(_lastObject, e.target);
                canvas.add(line);
                canvas.sendToBack(line);
                _lastObject = null;
                _pickingTo = false;
                canvas.discardActiveObject();
                canvas.requestRenderAll();
            } else {
                _pickingTo = true;
                _lastObject = canvas.getActiveObject();
            }
        }
    }

    function onStarDeselect(e) {
        if (_mode == "edit") {
            gid("attribute-panel").style.visibility = "hidden";
            unobserve("attribute-name");
            unobserve("attribute-color1");
            unobserve("attribute-color2");
            unobserve("attribute-size");
        }
    }

    function recalculateLinePoints(line) {
        var from = _stars.get(line.from).getCenterPoint();
        var to = _stars.get(line.to).getCenterPoint();
        var t2 = line.strokeWidth / 2;

        line.set({ 'x1': from.x - t2, 'y1': from.y - t2 });
        line.set({ 'x2': to.x - t2, 'y2': to.y - t2 });

        canvas.renderAll();
    }

    function onLineSelect(e) {
        var cfg = {
            name: {
                value: "disabled",
                disabled: true
            },
            color1: {
                disabled: false,
                tooltip: "Line Color"
            },
            color2: {
                disabled: true,
                tooltip: "disabled",
            },
            size: {
                disabled: false,
                min: LINE_MIN_SIZE,
                max: LINE_MAX_SIZE
            }
        };

        setupAttributePanel(cfg);

        observe(e.target, "attribute-color1", "stroke");
        observeInt(e.target, "attribute-size", "strokeWidth", () => {
            recalculateLinePoints(e.target);
            updateAttributeSizeTooltip();
        });

        updateAttributeSizeTooltip();
        gid("attribute-panel").style.visibility = "visible";
    }

    function onLineDeselect(e) {
        gid("attribute-panel").style.visibility = "hidden";
        unobserve("attribute-color1");
        unobserve("attribute-size");
    }

    function onStarMove(e) {
        updateLines(e.transform.target);
    }

    function deleteStarEvent(e) {
        var star = e.target;

        // copy so that we can remove values while iterating
        var lines_from_copy = star.lines_from.slice(0);
        lines_from_copy.forEach(uuid => {
            deleteLine(uuid);
        });

        // copy so that we can remove values while iterating
        var lines_to_copy = star.lines_to.slice(0);
        lines_to_copy.forEach(uuid => {
            deleteLine(uuid);
        });

        _stars.delete(star.uuid);
        canvas.remove(star);

        updateCounters();
    }

    function deleteLineEvent(e) {
        deleteLine(e.target.uuid);
        updateCounters();
    }

    function deleteLine(uuid) {
        var line = _lines.get(uuid);

        var idx = _stars.get(line.from).lines_from.indexOf(uuid);
        _stars.get(line.from).lines_from.splice(idx, 1);

        idx = _stars.get(line.to).lines_to.indexOf(uuid);
        _stars.get(line.to).lines_to.splice(idx, 1);

        _lines.delete(line.uuid);
        canvas.remove(line);
    }

    function updateLines(e) {
        var c = e.getCenterPoint();

        e.lines_from.forEach(uuid => {
            var l = _lines.get(uuid);
            var t2 = l.strokeWidth / 2;
            l.set({ 'x1': c.x - t2, 'y1': c.y - t2 });
        });

        e.lines_to.forEach(uuid => {
            var l = _lines.get(uuid);
            var t2 = l.strokeWidth / 2;
            l.set({ 'x2': c.x - t2, 'y2': c.y - t2 });
        });

        canvas.renderAll();
    }

    function observe(elem, id, property) {
        var el = document.getElementById(id);

        el.value = elem[property];
        el.oninput = function() {
            elem.set(property, this.value);
            elem.setCoords();
            canvas.renderAll();
        }
    }

    function observeInt(elem, id, property, func) {
        var el = document.getElementById(id);

        el.value = elem[property];
        el.oninput = function() {
            elem.set(property, parseInt(this.value, 10));
            elem.setCoords();

            if (func) {
                func();
            }

            canvas.renderAll();
        }
    }

    function unobserve(id) {
        document.getElementById(id).oninput = function(){};
    }

    function setupStar(star) {
        star.hasControls = false;
        star.selectable = false;

        star.toObject = (function(toObject) {
          return function() {
            return fabric.util.object.extend(toObject.call(this), {
              name: this.name,
              uuid: this.uuid,
              lines_from: this.lines_from,
              lines_to: this.lines_to
            });
          };
        })(star.toObject);

        _stars.set(star.uuid, star);
    }

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
        });

        star.name = name;
        star.uuid = uuidv4();

        star.lines_from = [];
        star.lines_to = [];

        setupStar(star);

        updateCounters();

        return star;
    }

    function setupLine(line) {
        line.selectable = false;
        line.evented = false;
        line.lockMovementX = true;
        line.lockMovementY = true;
        line.hasControls = false;

        line.toObject = (function(toObject) {
          return function() {
            return fabric.util.object.extend(toObject.call(this), {
              uuid: this.uuid,
              from: this.from,
              to: this.to
            });
          };
        })(line.toObject);

        _lines.set(line.uuid, line);
    }

    function makeLine(from, to) {
        var thickness = parseInt(gid("attribute-size").value, 10);
        var t2 = thickness / 2;
        var c1 = from.getCenterPoint();
        var c2 = to.getCenterPoint();
        // correct coords by half of line width
        var coords = [c1.x - t2, c1.y - t2, c2.x - t2, c2.y - t2];
        var line = new fabric.Line(coords, {
            stroke: gid("attribute-color2").value,
            strokeWidth: thickness
        });

        line.uuid = uuidv4();

        line.from = from.uuid;
        line.to = to.uuid;

        from.lines_from.push(line.uuid);
        to.lines_to.push(line.uuid);

        setupLine(line);

        updateCounters();

        return line;
    }

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

        return makeStar(rando(PADDING, CANVAS_WIDTH-PADDING), rando(PADDING, CANVAS_HEIGHT-PADDING), opts);
    }

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

    var canvas = this.__canvas = new fabric.Canvas('star-map', {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#000000',
        selection: false
    });

    gid("button-canvas").click();
})();