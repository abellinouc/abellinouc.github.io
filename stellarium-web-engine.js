var StelWebEngine = (function () {
    var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : undefined;
    if (typeof __filename !== "undefined") _scriptDir = _scriptDir || __filename;
    return function (StelWebEngine) {
        StelWebEngine = StelWebEngine || {};

        var Module = typeof StelWebEngine !== "undefined" ? StelWebEngine : {};
        var readyPromiseResolve, readyPromiseReject;
        Module["ready"] = new Promise(function (resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });
        Module["locateFile"] = function (path) {
            if (path === "stellarium-web-engine.wasm") return Module.wasmFile;
            return path;
        };
        Module["onRuntimeInitialized"] = function () {
            if (Module.canvasElement) Module.canvas = Module.canvasElement;
            if (Module.canvas) {
                var contextAttributes = {};
                contextAttributes.alpha = false;
                contextAttributes.depth = true;
                contextAttributes.stencil = true;
                contextAttributes.antialias = true;
                contextAttributes.premultipliedAlpha = true;
                contextAttributes.preserveDrawingBuffer = false;
                contextAttributes.preferLowPowerToHighPerformance = false;
                contextAttributes.failIfMajorPerformanceCaveat = false;
                contextAttributes.majorVersion = 1;
                contextAttributes.minorVersion = 0;
                var ctx = Module.GL.createContext(Module.canvas, contextAttributes);
                Module.GL.makeContextCurrent(ctx);
            }
            Module["_setValue"] = Module["setValue"];
            Module["_getValue"] = Module["getValue"];
            for (var i in Module.extendFns) {
                Module.extendFns[i]();
            }
            Module._core_init(0, 0, 1);
            Module.core = Module.getModule("core");
            Module.observer = Module.core.observer;
            if (Module.translateFn) {
                Module.translationsCache = {};
                let callback = Module.addFunction(function (user, domain, str) {
                    domain = Module.UTF8ToString(domain);
                    str = Module.UTF8ToString(str);
                    str = Module.translateFn(domain, str);
                    let value = Module.translationsCache[str];
                    if (value) return value;
                    let size = Module.lengthBytesUTF8(str) + 1;
                    value = Module._malloc(size);
                    Module.stringToUTF8(str, value, size);
                    Module.translationsCache[str] = value;
                    return value;
                }, "iiii");
                Module._sys_set_translate_function(callback);
            }
            if (Module.onReady) Module.onReady(Module);
        };
        Module["extendFns"] = [];
        Module["afterInit"] = function (f) {
            Module.extendFns.push(f);
        };
        Module["D2R"] = Math.PI / 180;
        Module["R2D"] = 180 / Math.PI;
        Module["FRAME_ASTROM"] = 0;
        Module["FRAME_ICRF"] = 1;
        Module["FRAME_CIRS"] = 2;
        Module["FRAME_JNOW"] = 3;
        Module["FRAME_OBSERVED_GEOM"] = 4;
        Module["FRAME_OBSERVED"] = 5;
        Module["FRAME_MOUNT"] = 6;
        Module["FRAME_VIEW"] = 7;
        Module["FRAME_ECLIPTIC"] = 8;
        Module["MJD2date"] = function (v) {
            return new Date(Math.round((v + 2400000.5 - 2440587.5) * 864e5));
        };
        Module["date2MJD"] = function (date) {
            return date / 864e5 - 2400000.5 + 2440587.5;
        };
        Module["a2tf"] = function (angle, resolution) {
            resolution = resolution || 0;
            var a2tf_json = Module.cwrap("a2tf_json", "number", ["number", "number"]);
            var cret = a2tf_json(resolution, angle);
            var ret = Module.UTF8ToString(cret);
            Module._free(cret);
            ret = JSON.parse(ret);
            return ret;
        };
        Module["a2af"] = function (angle, resolution) {
            resolution = resolution || 0;
            var a2af_json = Module.cwrap("a2af_json", "number", ["number", "number"]);
            var cret = a2af_json(resolution, angle);
            var ret = Module.UTF8ToString(cret);
            Module._free(cret);
            ret = JSON.parse(ret);
            return ret;
        };
        Module["calendar"] = function (args) {
            if (arguments.length == 3) {
                args = {
                    start: arguments[0],
                    end: arguments[1],
                    onEvent: function (ev) {
                        arguments[2](ev.time, ev.type, ev.desc, ev.flags, ev.o1, ev.o2);
                    },
                };
            }
            var start = args.start / 864e5 + 2440587.5 - 2400000.5;
            var end = args.end / 864e5 + 2440587.5 - 2400000.5;
            var getCallback = function () {
                return Module.addFunction(function (time, type, desc, flags, o1, o2, user) {
                    var ev = { time: Module.MJD2date(time), type: Module.UTF8ToString(type), desc: Module.UTF8ToString(desc), o1: o1 ? new Module.SweObj(o1) : null, o2: o2 ? new Module.SweObj(o2) : null };
                    args.onEvent(ev);
                }, "idiiiiii");
            };
            if (args.iterator) {
                var cal = Module._calendar_create(this.observer.v, start, end, 1);
                return function () {
                    var ret = Module._calendar_compute(cal);
                    if (!ret) {
                        var callback = getCallback();
                        Module._calendar_get_results_callback(cal, 0, callback);
                        Module.removeFunction(callback);
                        Module._calendar_delete(cal);
                    }
                    return ret;
                };
            }
            var callback = getCallback();
            Module._calendar_get(this.observer.v, start, end, 1, 0, callback);
            Module.removeFunction(callback);
        };
        Module["designationCleanup"] = function (d, flags) {
            const designation_cleanup = Module.cwrap("designation_cleanup", null, ["string", "number", "number", "number"]);
            const cbuf = Module._malloc(256);
            designation_cleanup(d, cbuf, 256, flags);
            const ret = Module.UTF8ToString(cbuf);
            Module._free(out);
            return ret;
        };
        Module["c2s"] = function (v) {
            var x = v[0];
            var y = v[1];
            var z = v[2];
            var d2 = x * x + y * y;
            var theta = d2 == 0 ? 0 : Math.atan2(y, x);
            var phi = z === 0 ? 0 : Math.atan2(z, Math.sqrt(d2));
            return [theta, phi];
        };
        Module["s2c"] = function (theta, phi) {
            var cp = Math.cos(phi);
            return [Math.cos(theta) * cp, Math.sin(theta) * cp, Math.sin(phi)];
        };
        Module["anp"] = function (a) {
            var v = a % (2 * Math.PI);
            if (v < 0) v += 2 * Math.PI;
            return v;
        };
        Module["anpm"] = function (a) {
            var v = a % (2 * Math.PI);
            if (Math.abs(v) >= Math.PI) v -= 2 * Math.PI * Math.sign(a);
            return v;
        };
        const asFrame = function (f) {
            if (f === "ASTROM") return Module.FRAME_ASTROM;
            if (f === "ICRF") return Module.FRAME_ICRF;
            if (f === "CIRS") return Module.FRAME_CIRS;
            if (f === "JNOW") return Module.FRAME_JNOW;
            if (f === "OBSERVED") return Module.FRAME_OBSERVED;
            if (f === "OBSERVED_GEOM") return Module.FRAME_OBSERVED_GEOM;
            if (f === "MOUNT") return Module.FRAME_MOUNT;
            if (f === "VIEW") return Module.FRAME_VIEW;
            assert(typeof f === "number");
            return f;
        };
        Module["convertFrame"] = function (obs, origin, dest, v) {
            origin = asFrame(origin);
            dest = asFrame(dest);
            var v4 = [v[0], v[1], v[2], v[3] || 0];
            var ptr = Module._malloc(8 * 8);
            var i;
            for (i = 0; i < 4; i++) Module._setValue(ptr + i * 8, v4[i], "double");
            Module._convert_framev4(obs.v, origin, dest, ptr, ptr + 4 * 8);
            var ret = new Array(4);
            for (i = 0; i < 4; i++) ret[i] = Module._getValue(ptr + (4 + i) * 8, "double");
            Module._free(ptr);
            return ret;
        };
        Module["lookAt"] = function (pos, duration) {
            if (duration === undefined) duration = 1;
            var v = Module._malloc(3 * 8);
            var i;
            for (i = 0; i < 3; i++) Module._setValue(v + i * 8, pos[i], "double");
            Module._core_lookat(v, duration);
            Module._free(v);
        };
        Module["pointAndLock"] = function (target, duration) {
            if (duration === undefined) duration = 1;
            Module._core_point_and_lock(target.v, duration);
        };
        Module["zoomTo"] = function (fov, duration) {
            if (duration === undefined) duration = 1;
            Module._core_zoomto(fov, duration);
        };
        Module["otypeToStr"] = function (otype) {
            var otype_to_str = Module.cwrap("otype_to_str", "number", ["string"]);
            var cret = otype_to_str(otype);
            return Module.UTF8ToString(cret);
        };
        let onClickCallback;
        let onClickFn;
        let onRectCallback;
        let onRectFn;
        Module["on"] = function (eventName, callback) {
            if (eventName === "click") {
                if (!onClickFn) {
                    onClickFn = Module.addFunction(function (x, y) {
                        return onClickCallback({ point: { x: x, y: y } });
                    }, "idd");
                }
                onClickCallback = callback;
                Module.core.on_click = onClickFn;
            }
            if (eventName === "rectSelection") {
                onRectFn = Module.addFunction(function (x1, y1, x2, y2) {
                    return onRectCallback({
                        rect: [
                            { x: x1, y: y1 },
                            { x: x2, y: y2 },
                        ],
                    });
                }, "idddd");
                onRectCallback = callback;
                Module.core.on_rect = onRectFn;
            }
        };
        Module["setFont"] = function (font, url) {
            return fetch(url)
                .then(function (response) {
                    if (!response.ok) throw new Error(`Cannot get ${url}`);
                    return response.arrayBuffer();
                })
                .then(function (data) {
                    data = new Uint8Array(data);
                    let ptr = Module._malloc(data.length);
                    Module.writeArrayToMemory(data, ptr);
                    Module.ccall("core_add_font", null, ["number", "string", "string", "number", "number", "number"], [0, font, null, ptr, data.length]);
                    let url = font === "regular" ? "asset://font/NotoSans-Regular.ttf" : "asset://font/NotoSans-Bold.ttf";
                    Module.ccall("core_add_font", null, ["number", "string", "string", "number", "number", "number"], [0, font, url, 0, 0]);
                });
        };
        Module.afterInit(function () {
            var obj_call_json_str = Module.cwrap("obj_call_json_str", "number", ["number", "string", "string"]);
            var core_search = Module.cwrap("core_search", "number", ["string"]);
            var obj_get_id = Module.cwrap("obj_get_id", "string", ["number"]);
            var module_add = Module.cwrap("module_add", null, ["number", "number"]);
            var module_remove = Module.cwrap("module_remove", null, ["number", "number"]);
            var module_get_tree = Module.cwrap("module_get_tree", "number", ["number", "number"]);
            var module_get_path = Module.cwrap("module_get_path", "number", ["number", "number"]);
            var obj_create_str = Module.cwrap("obj_create_str", "number", ["string", "string"]);
            var module_get_child = Module.cwrap("module_get_child", "number", ["number", "string"]);
            var core_get_module = Module.cwrap("core_get_module", "number", ["string"]);
            var obj_get_info_json = Module.cwrap("obj_get_info_json", "number", ["number", "number", "string"]);
            var obj_get_json_data_str = Module.cwrap("obj_get_json_data_str", "number", ["number"]);
            var g_listeners = [];
            let g_ret;
            let g_obj_foreach_attr_callback = Module.addFunction(function (attr, isProp, user) {
                g_ret.push([attr, isProp]);
            }, "viii");
            let g_obj_foreach_child_callback = Module.addFunction(function (id) {
                g_ret.push(id);
            }, "vi");
            let g_obj_get_designations_callback = Module.addFunction(function (o, u, v) {
                g_ret.push(v);
            }, "viii");
            let g_module_list_obj2 = Module.addFunction(function (user, obj) {
                g_ret.push(obj);
                return 0;
            }, "iii");
            var SweObj = function (v) {
                assert(typeof v === "number");
                this.v = v;
                this.swe_ = 1;
                var that = this;
                g_ret = [];
                Module._obj_foreach_attr(this.v, 0, g_obj_foreach_attr_callback);
                for (let i = 0; i < g_ret.length; i++) {
                    let attr = g_ret[i][0];
                    let isProp = g_ret[i][1];
                    let name = Module.UTF8ToString(attr);
                    if (!isProp) {
                        that[name] = function (args) {
                            return that._call(name, args);
                        };
                    } else {
                        Object.defineProperty(that, name, {
                            configurable: true,
                            enumerable: true,
                            get: function () {
                                return that._call(name);
                            },
                            set: function (v) {
                                return that._call(name, v);
                            },
                        });
                    }
                }
                g_ret = [];
                Module._obj_foreach_child(this.v, g_obj_foreach_child_callback);
                for (let i = 0; i < g_ret.length; i++) {
                    let id = Module.UTF8ToString(g_ret[i]);
                    if (!id) return;
                    Object.defineProperty(that, id, {
                        enumerable: true,
                        get: function () {
                            var obj = module_get_child(that.v, id);
                            return obj ? new SweObj(obj) : null;
                        },
                    });
                }
            };
            SweObj.prototype.valueOf = function () {
                return this.id;
            };
            SweObj.prototype.update = function () {
                Module._module_update(this.v, 0);
            };
            SweObj.prototype.getInfo = function (info, obs) {
                if (obs === undefined) obs = Module.observer;
                Module._observer_update(obs.v, true);
                var cret = obj_get_info_json(this.v, obs.v, info);
                if (cret === 0) return undefined;
                var ret = Module.UTF8ToString(cret);
                Module._free(cret);
                ret = JSON.parse(ret);
                if (!ret.swe_) return ret;
                return ret.v;
            };
            SweObj.prototype.clone = function () {
                return new SweObj(Module._obj_clone(this.v));
            };
            SweObj.prototype.destroy = function () {
                Module._obj_release(this.v);
            };
            SweObj.prototype.retain = function () {
                Module._obj_retain(this.v);
            };
            SweObj.prototype.change = function (attr, callback, context) {
                g_listeners.push({ obj: this.v, ctx: context ? context : this, attr: attr, callback: callback });
            };
            SweObj.prototype.add = function (type, args) {
                if (args === undefined) {
                    var obj = type;
                    module_add(this.v, obj.v);
                    return obj;
                } else {
                    let obj = Module.createObj(type, args);
                    this.add(obj);
                    return obj;
                }
            };
            SweObj.prototype.remove = function (obj) {
                module_remove(this.v, obj.v);
            };
            SweObj.prototype.designations = function () {
                g_ret = [];
                Module._obj_get_designations(this.v, 0, g_obj_get_designations_callback);
                let ret = g_ret.map(function (v) {
                    return Module.UTF8ToString(v);
                });
                ret = ret.filter(function (item, pos, self) {
                    return self.indexOf(item) == pos;
                });
                return ret;
            };
            SweObj.prototype.culturalDesignations = function () {
                let ret = Module._skycultures_get_cultural_names_json(this.v);
                ret = Module.UTF8ToString(ret);
                Module._free(ret);
                ret = JSON.parse(ret);
                return ret;
            };
            SweObj.prototype.listObjs = function (obs, maxMag, filter) {
                let ret = [];
                g_ret = [];
                Module._module_list_objs2(this.v, obs.v, maxMag, 0, g_module_list_obj2);
                for (let i = 0; i < g_ret.length; i++) {
                    let obj = new SweObj(g_ret[i]);
                    if (filter(obj)) {
                        obj.retain();
                        ret.push(obj);
                    }
                }
                return ret;
            };
            SweObj.prototype.getTree = function (detailed) {
                detailed = detailed !== undefined ? detailed : false;
                var cret = module_get_tree(this.v, detailed);
                var ret = Module.UTF8ToString(cret);
                Module._free(cret);
                ret = JSON.parse(ret);
                return ret;
            };
            SweObj.prototype.computeVisibility = function (args) {
                args = args || {};
                var obs = args.obs || Module.core.observer;
                var startTime = args.startTime || obs.tt - 1 / 2;
                var endTime = args.endTime || obs.tt + 1 / 2;
                var precision = 1 / 24 / 60 / 2;
                var rise = Module._compute_event(obs.v, this.v, 1, startTime, endTime, precision) || null;
                var set = Module._compute_event(obs.v, this.v, 2, startTime, endTime, precision) || null;
                if (rise === null && set === null) {
                    var p = this.getInfo("radec", obs);
                    p = Module.convertFrame(obs, "ICRF", "OBSERVED", p);
                    if (p[2] < 0) return [];
                }
                return [{ rise: rise, set: set }];
            };
            Object.defineProperty(SweObj.prototype, "id", {
                get: function () {
                    var ret = obj_get_id(this.v);
                    if (ret) return ret;
                    return this.designations()[0];
                },
            });
            Object.defineProperty(SweObj.prototype, "path", {
                get: function () {
                    if (this.v === Module.core.v) return "core";
                    var cret = module_get_path(this.v, Module.core.v);
                    var ret = Module.UTF8ToString(cret);
                    Module._free(cret);
                    return "core." + ret;
                },
            });
            Object.defineProperty(SweObj.prototype, "jsonData", {
                get: function () {
                    var cret = obj_get_json_data_str(this.v);
                    var ret = Module.UTF8ToString(cret);
                    Module._free(cret);
                    return ret ? JSON.parse(ret) : undefined;
                },
            });
            Object.defineProperty(SweObj.prototype, "icrs", {
                get: function () {
                    return this.radec;
                },
            });
            SweObj.prototype._call = function (attr, arg) {
                if (arg === undefined || arg === null) arg = 0;
                else arg = JSON.stringify(arg);
                var cret = obj_call_json_str(this.v, attr, arg);
                var ret = Module.UTF8ToString(cret);
                Module._free(cret);
                if (!ret) return null;
                ret = JSON.parse(ret);
                if (!ret.swe_) return ret;
                if (ret.type === "obj") {
                    let v = parseInt(ret.v);
                    return v ? new SweObj(v) : null;
                }
                return ret.v;
            };
            SweObj.prototype.addDataSource = function (args) {
                var add_data_source = Module.cwrap("module_add_data_source", "number", ["number", "string", "string"]);
                add_data_source(this.v, args.url, args.key || 0);
            };
            Module["getModule"] = function (name) {
                var obj = core_get_module(name);
                return obj ? new SweObj(obj) : null;
            };
            Module["getObj"] = function (name) {
                assert(typeof name == "string");
                var obj = core_search(name);
                return obj ? new SweObj(obj) : null;
            };
            Module["change"] = function (callback, context) {
                g_listeners.push({ obj: null, ctx: context ? context : null, attr: null, callback: callback });
            };
            Module["getTree"] = function (detailed) {
                return Module.core.getTree(detailed);
            };
            Module["createLayer"] = function (data) {
                return Module.core.add("layer", data);
            };
            function stringToC(str) {
                let size = Module.lengthBytesUTF8(str);
                let ptr = Module._malloc(size + 1);
                Module.writeAsciiToMemory(str, ptr, false);
                return ptr;
            }
            Module["createObj"] = function (type, args) {
                args = args ? stringToC(JSON.stringify(args)) : 0;
                const ctype = stringToC(type);
                let ret = Module._obj_create_str(ctype, args);
                Module._free(type);
                Module._free(args);
                ret = ret ? new SweObj(ret) : null;
                if (type === "geojson") Module.onGeojsonObj(ret);
                if (type === "geojson-survey") Module.onGeojsonSurveyObj(ret);
                return ret;
            };
            var onObjChanged = Module.addFunction(function (objPtr, attr) {
                attr = Module.UTF8ToString(attr);
                for (var i = 0; i < g_listeners.length; i++) {
                    var listener = g_listeners[i];
                    if ((listener.obj === null || listener.obj === objPtr) && (listener.attr === null || listener.attr === attr)) {
                        var obj = new SweObj(objPtr);
                        listener.callback.apply(listener.ctx, [obj, attr]);
                    }
                }
            }, "vii");
            Module._module_add_global_listener(onObjChanged);
            Module["getTree"] = function () {
                return Module.core.getTree();
            };
            Module["getValue"] = function (path) {
                var elems = path.split(".");
                var attr = elems.pop();
                var objPath = elems.join(".");
                let obj = Module.core[objPath] || Module.getModule("core." + objPath);
                var value = obj[attr];
                if (value && typeof value === "object" && value.swe_) value = value.v;
                return value;
            };
            Module["_setValue"] = Module.setValue;
            Module["setValue"] = function (path, value) {
                var elems = path.split(".");
                var attr = elems.pop();
                var objPath = elems.join(".");
                let obj = Module.core[objPath] || Module.getModule("core." + objPath);
                obj[attr] = value;
            };
            Module["onValueChanged"] = function (callback) {
                Module.change(function (obj, attr) {
                    var path = obj.path + "." + attr;
                    var value = obj[attr];
                    if (value && typeof value === "object" && value.swe_) value = value.v;
                    path = path.substr(5);
                    callback(path, value);
                });
            };
            Module["SweObj"] = SweObj;
        });
        function fillColorPtr(color, ptr) {
            Module._geojson_set_color_ptr_(ptr, color[0], color[1], color[2], color[3]);
        }
        function fillBoolPtr(value, ptr) {
            Module._geojson_set_bool_ptr_(ptr, value);
        }
        function setData(obj, data) {
            Module._geojson_remove_all_features(obj.v);
            obj._features = data.features;
            for (const feature of data.features) {
                const geo = feature.geometry;
                if (geo.type !== "Polygon") {
                    console.error("Only support polygon geometry");
                    continue;
                }
                if (geo.coordinates.length != 1) {
                    console.error("Only support single ring polygons");
                    continue;
                }
                const coordinates = geo.coordinates[0];
                const size = coordinates.length;
                const ptr = Module._malloc(size * 16);
                for (let i = 0; i < size; i++) {
                    Module._setValue(ptr + i * 16 + 0, coordinates[i][0], "double");
                    Module._setValue(ptr + i * 16 + 8, coordinates[i][1], "double");
                }
                Module._geojson_add_poly_feature(obj.v, size, ptr);
                Module._free(ptr);
            }
        }
        function filterAll(obj, callback) {
            const features = obj._features;
            const fn = Module.addFunction(function (idx, fillPtr, strokePtr) {
                const r = callback(idx, features[idx]);
                if (r === false) return 0;
                if (r === true) return 1;
                if (r.fill) fillColorPtr(r.fill, fillPtr);
                if (r.stroke) fillColorPtr(r.stroke, strokePtr);
                let ret = r.visible === false ? 0 : 1;
                if (r.blink === true) ret |= 2;
                return ret;
            }, "iiii");
            Module._geojson_filter_all(obj.v, fn);
            Module.removeFunction(fn);
        }
        function queryRenderedFeatureIds(obj, point) {
            if (typeof point === "object") {
                point = [point.x, point.y];
            }
            const pointPtr = Module._malloc(16);
            Module._setValue(pointPtr + 0, point[0], "double");
            Module._setValue(pointPtr + 8, point[1], "double");
            const size = 128;
            const retPtr = Module._malloc(4 * size);
            const nb = Module._geojson_query_rendered_features(obj.v, pointPtr, size, retPtr);
            let ret = [];
            for (let i = 0; i < nb; i++) {
                ret.push(Module._getValue(retPtr + i * 4, "i32"));
            }
            Module._free(pointPtr);
            Module._free(retPtr);
            return ret;
        }
        Module["onGeojsonObj"] = function (obj) {
            let filterFn = null;
            Object.defineProperty(obj, "filter", {
                set: function (filter) {
                    if (filterFn) Module.removeFunction(filterFn);
                    filterFn = Module.addFunction(function (img, id, fillPtr, strokePtr, blinkPtr, hiddenPtr) {
                        const r = filter(id);
                        if (r.fill) fillColorPtr(r.fill, fillPtr);
                        if (r.stroke) fillColorPtr(r.stroke, strokePtr);
                        if (r.stroke) fillColorPtr(r.stroke, strokePtr);
                        if (r.blink !== undefined) fillBoolPtr(r.blink, blinkPtr);
                        if (r.hidden !== undefined) fillBoolPtr(r.hidden, hiddenPtr);
                    }, "viiiiii");
                    obj._call("filter", filterFn);
                },
            });
            obj.setData = function (data) {
                setData(obj, data);
            };
            obj.filterAll = function (callback) {
                filterAll(obj, callback);
            };
            obj.queryRenderedFeatureIds = function (point) {
                return queryRenderedFeatureIds(obj, point);
            };
        };
        let g_tiles = {};
        function asBox(box) {
            if (!(box instanceof Array)) {
                return [
                    [box.x, box.y],
                    [box.x, box.y],
                ];
            }
            assert(box instanceof Array);
            return box.map(function (v) {
                if (!(v instanceof Array)) {
                    return [v.x, v.y];
                }
                return v;
            });
        }
        function surveyQueryRenderedFeatures(obj, box) {
            box = asBox(box);
            const boxPtr = Module._malloc(32);
            Module._setValue(boxPtr + 0, box[0][0], "double");
            Module._setValue(boxPtr + 8, box[0][1], "double");
            Module._setValue(boxPtr + 16, box[1][0], "double");
            Module._setValue(boxPtr + 24, box[1][1], "double");
            const size = 1024;
            const tilesPtr = Module._malloc(4 * size);
            const indexPtr = Module._malloc(4 * size);
            const nb = Module._geojson_survey_query_rendered_features(obj.v, boxPtr, size, tilesPtr, indexPtr);
            let ret = [];
            for (let i = 0; i < nb; i++) {
                const tile = Module._getValue(tilesPtr + i * 4, "i32*");
                const idx = Module._getValue(indexPtr + i * 4, "i32");
                ret.push(g_tiles[tile][idx]);
            }
            Module._free(boxPtr);
            Module._free(indexPtr);
            Module._free(tilesPtr);
            return ret;
        }
        let onNewTile = function (img, json) {
            json = Module.UTF8ToString(json);
            json = JSON.parse(json);
            g_tiles[img] = json.features;
        };
        let onNewTileSet = false;
        Module["onGeojsonSurveyObj"] = function (obj) {
            if (!onNewTileSet) {
                Module._geojson_set_on_new_tile_callback(Module.addFunction(onNewTile, "vii"));
                onNewTileSet = true;
            }
            Object.defineProperty(obj, "filter", {
                set: function (filter) {
                    if (obj._filterFn) Module.removeFunction(obj._filterFn);
                    obj._filterFn = Module.addFunction(function (img, id, fillPtr, strokePtr, blinkPtr, hiddenPtr) {
                        let features = g_tiles[img];
                        const r = filter(features[id]);
                        if (r.fill) fillColorPtr(r.fill, fillPtr);
                        if (r.stroke) fillColorPtr(r.stroke, strokePtr);
                        if (r.blink !== undefined) fillBoolPtr(r.blink, blinkPtr);
                        if (r.hidden !== undefined) fillBoolPtr(r.hidden, hiddenPtr);
                    }, "viiiiii");
                    obj._call("filter", obj._filterFn);
                },
            });
            obj.queryRenderedFeatures = function (point) {
                return surveyQueryRenderedFeatures(obj, point);
            };
        };
        Module.afterInit(function () {
            if (!Module.canvas) return;
            var mouseDown = false;
            var mouseButtons = 0;
            var mousePos;
            var render = function (timestamp) {
                if (mouseDown) Module._core_on_mouse(0, 1, mousePos.x, mousePos.y, mouseButtons);
                var canvas = Module.canvas;
                var dpr = window.devicePixelRatio || 1;
                var rect = canvas.getBoundingClientRect();
                var displayWidth = rect.width;
                var displayHeight = rect.height;
                var sizeChanged = canvas.width !== displayWidth || canvas.height !== displayHeight;
                if (sizeChanged) {
                    canvas.width = displayWidth * dpr;
                    canvas.height = displayHeight * dpr;
                }
                Module._core_update();
                Module._core_render(displayWidth, displayHeight, dpr);
                window.requestAnimationFrame(render);
            };
            var fixPageXY = function (e) {
                if (e.pageX == null && e.clientX != null) {
                    var html = document.documentElement;
                    var body = document.body;
                    e.pageX = e.clientX + (html.scrollLeft || (body && body.scrollLeft) || 0);
                    e.pageX -= html.clientLeft || 0;
                    e.pageY = e.clientY + (html.scrollTop || (body && body.scrollTop) || 0);
                    e.pageY -= html.clientTop || 0;
                }
            };
            var setupMouse = function () {
                var canvas = Module.canvas;
                function getMousePos(evt) {
                    var rect = canvas.getBoundingClientRect();
                    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
                }
                canvas.addEventListener("mousedown", function (e) {
                    var that = this;
                    e = e || event;
                    fixPageXY(e);
                    mouseDown = true;
                    mousePos = getMousePos(e);
                    mouseButtons = e.buttons;
                    document.onmouseup = function (e) {
                        e = e || event;
                        fixPageXY(e);
                        mouseDown = false;
                        mousePos = getMousePos(e);
                        Module._core_on_mouse(0, 0, mousePos.x, mousePos.y, mouseButtons);
                    };
                    document.onmouseleave = function (e) {
                        mouseDown = false;
                    };
                    document.onmousemove = function (e) {
                        e = e || event;
                        fixPageXY(e);
                        mousePos = getMousePos(e);
                    };
                });
                canvas.addEventListener(
                    "touchstart",
                    function (e) {
                        var rect = canvas.getBoundingClientRect();
                        for (var i = 0; i < e.changedTouches.length; i++) {
                            var id = e.changedTouches[i].identifier;
                            var relX = e.changedTouches[i].pageX - rect.left;
                            var relY = e.changedTouches[i].pageY - rect.top;
                            Module._core_on_mouse(id, 1, relX, relY, 1);
                        }
                    },
                    { passive: true }
                );
                canvas.addEventListener(
                    "touchmove",
                    function (e) {
                        e.preventDefault();
                        var rect = canvas.getBoundingClientRect();
                        for (var i = 0; i < e.changedTouches.length; i++) {
                            var id = e.changedTouches[i].identifier;
                            var relX = e.changedTouches[i].pageX - rect.left;
                            var relY = e.changedTouches[i].pageY - rect.top;
                            Module._core_on_mouse(id, -1, relX, relY, 1);
                        }
                    },
                    { passive: false }
                );
                canvas.addEventListener("touchend", function (e) {
                    var rect = canvas.getBoundingClientRect();
                    for (var i = 0; i < e.changedTouches.length; i++) {
                        var id = e.changedTouches[i].identifier;
                        var relX = e.changedTouches[i].pageX - rect.left;
                        var relY = e.changedTouches[i].pageY - rect.top;
                        Module._core_on_mouse(id, 0, relX, relY, 1);
                    }
                });
                function getMouseWheelDelta(event) {
                    var delta = 0;
                    switch (event.type) {
                        case "DOMMouseScroll":
                            delta = -event.detail;
                            break;
                        case "mousewheel":
                            delta = event.wheelDelta / 120;
                            break;
                        default:
                            throw "unrecognized mouse wheel event: " + event.type;
                    }
                    return delta;
                }
                var onWheelEvent = function (e) {
                    e.preventDefault();
                    fixPageXY(e);
                    var pos = getMousePos(e);
                    var zoom_factor = 1.05;
                    var delta = getMouseWheelDelta(e) * 2;
                    Module._core_on_zoom(Math.pow(zoom_factor, delta), pos.x, pos.y);
                    return false;
                };
                canvas.addEventListener("mousewheel", onWheelEvent, { passive: false });
                canvas.addEventListener("DOMMouseScroll", onWheelEvent, { passive: false });
                canvas.oncontextmenu = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                };
            };
            setupMouse();
            window.requestAnimationFrame(render);
        });
        var moduleOverrides = {};
        var key;
        for (key in Module) {
            if (Module.hasOwnProperty(key)) {
                moduleOverrides[key] = Module[key];
            }
        }
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = function (status, toThrow) {
            throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = false;
        var ENVIRONMENT_IS_WORKER = false;
        var ENVIRONMENT_IS_NODE = false;
        var ENVIRONMENT_IS_SHELL = false;
        ENVIRONMENT_IS_WEB = typeof window === "object";
        ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
        ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
        ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
        var scriptDirectory = "";
        function locateFile(path) {
            if (Module["locateFile"]) {
                return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
        }
        var read_, readAsync, readBinary, setWindowTitle;
        var nodeFS;
        var nodePath;
        if (ENVIRONMENT_IS_NODE) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = require("path").dirname(scriptDirectory) + "/";
            } else {
                scriptDirectory = __dirname + "/";
            }
            read_ = function shell_read(filename, binary) {
                if (!nodeFS) nodeFS = require("fs");
                if (!nodePath) nodePath = require("path");
                filename = nodePath["normalize"](filename);
                return nodeFS["readFileSync"](filename, binary ? null : "utf8");
            };
            readBinary = function readBinary(filename) {
                var ret = read_(filename, true);
                if (!ret.buffer) {
                    ret = new Uint8Array(ret);
                }
                assert(ret.buffer);
                return ret;
            };
            if (process["argv"].length > 1) {
                thisProgram = process["argv"][1].replace(/\\/g, "/");
            }
            arguments_ = process["argv"].slice(2);
            process["on"]("uncaughtException", function (ex) {
                if (!(ex instanceof ExitStatus)) {
                    throw ex;
                }
            });
            process["on"]("unhandledRejection", abort);
            quit_ = function (status) {
                process["exit"](status);
            };
            Module["inspect"] = function () {
                return "[Emscripten Module object]";
            };
        } else if (ENVIRONMENT_IS_SHELL) {
            if (typeof read != "undefined") {
                read_ = function shell_read(f) {
                    return read(f);
                };
            }
            readBinary = function readBinary(f) {
                var data;
                if (typeof readbuffer === "function") {
                    return new Uint8Array(readbuffer(f));
                }
                data = read(f, "binary");
                assert(typeof data === "object");
                return data;
            };
            if (typeof scriptArgs != "undefined") {
                arguments_ = scriptArgs;
            } else if (typeof arguments != "undefined") {
                arguments_ = arguments;
            }
            if (typeof quit === "function") {
                quit_ = function (status) {
                    quit(status);
                };
            }
            if (typeof print !== "undefined") {
                if (typeof console === "undefined") console = {};
                console.log = print;
                console.warn = console.error = typeof printErr !== "undefined" ? printErr : print;
            }
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = self.location.href;
            } else if (document.currentScript) {
                scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
                scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
                scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
            } else {
                scriptDirectory = "";
            }
            {
                read_ = function shell_read(url) {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", url, false);
                    xhr.send(null);
                    return xhr.responseText;
                };
                if (ENVIRONMENT_IS_WORKER) {
                    readBinary = function readBinary(url) {
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", url, false);
                        xhr.responseType = "arraybuffer";
                        xhr.send(null);
                        return new Uint8Array(xhr.response);
                    };
                }
                readAsync = function readAsync(url, onload, onerror) {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = function xhr_onload() {
                        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
                            onload(xhr.response);
                            return;
                        }
                        onerror();
                    };
                    xhr.onerror = onerror;
                    xhr.send(null);
                };
            }
            setWindowTitle = function (title) {
                document.title = title;
            };
        } else {
        }
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.warn.bind(console);
        for (key in moduleOverrides) {
            if (moduleOverrides.hasOwnProperty(key)) {
                Module[key] = moduleOverrides[key];
            }
        }
        moduleOverrides = null;
        if (Module["arguments"]) arguments_ = Module["arguments"];
        if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
        if (Module["quit"]) quit_ = Module["quit"];
        function dynamicAlloc(size) {
            var ret = HEAP32[DYNAMICTOP_PTR >> 2];
            var end = (ret + size + 15) & -16;
            HEAP32[DYNAMICTOP_PTR >> 2] = end;
            return ret;
        }
        function getNativeTypeSize(type) {
            switch (type) {
                case "i1":
                case "i8":
                    return 1;
                case "i16":
                    return 2;
                case "i32":
                    return 4;
                case "i64":
                    return 8;
                case "float":
                    return 4;
                case "double":
                    return 8;
                default: {
                    if (type[type.length - 1] === "*") {
                        return 4;
                    } else if (type[0] === "i") {
                        var bits = Number(type.substr(1));
                        assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
                        return bits / 8;
                    } else {
                        return 0;
                    }
                }
            }
        }
        function warnOnce(text) {
            if (!warnOnce.shown) warnOnce.shown = {};
            if (!warnOnce.shown[text]) {
                warnOnce.shown[text] = 1;
                err(text);
            }
        }
        function convertJsFunctionToWasm(func, sig) {
            if (typeof WebAssembly.Function === "function") {
                var typeNames = { i: "i32", j: "i64", f: "f32", d: "f64" };
                var type = { parameters: [], results: sig[0] == "v" ? [] : [typeNames[sig[0]]] };
                for (var i = 1; i < sig.length; ++i) {
                    type.parameters.push(typeNames[sig[i]]);
                }
                return new WebAssembly.Function(type, func);
            }
            var typeSection = [1, 0, 1, 96];
            var sigRet = sig.slice(0, 1);
            var sigParam = sig.slice(1);
            var typeCodes = { i: 127, j: 126, f: 125, d: 124 };
            typeSection.push(sigParam.length);
            for (var i = 0; i < sigParam.length; ++i) {
                typeSection.push(typeCodes[sigParam[i]]);
            }
            if (sigRet == "v") {
                typeSection.push(0);
            } else {
                typeSection = typeSection.concat([1, typeCodes[sigRet]]);
            }
            typeSection[1] = typeSection.length - 2;
            var bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0].concat(typeSection, [2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0]));
            var module = new WebAssembly.Module(bytes);
            var instance = new WebAssembly.Instance(module, { e: { f: func } });
            var wrappedFunc = instance.exports["f"];
            return wrappedFunc;
        }
        var freeTableIndexes = [];
        var functionsInTableMap;
        function addFunctionWasm(func, sig) {
            var table = wasmTable;
            if (!functionsInTableMap) {
                functionsInTableMap = new WeakMap();
                for (var i = 0; i < table.length; i++) {
                    var item = table.get(i);
                    if (item) {
                        functionsInTableMap.set(item, i);
                    }
                }
            }
            if (functionsInTableMap.has(func)) {
                return functionsInTableMap.get(func);
            }
            var ret;
            if (freeTableIndexes.length) {
                ret = freeTableIndexes.pop();
            } else {
                ret = table.length;
                try {
                    table.grow(1);
                } catch (err) {
                    if (!(err instanceof RangeError)) {
                        throw err;
                    }
                    throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
                }
            }
            try {
                table.set(ret, func);
            } catch (err) {
                if (!(err instanceof TypeError)) {
                    throw err;
                }
                var wrapped = convertJsFunctionToWasm(func, sig);
                table.set(ret, wrapped);
            }
            functionsInTableMap.set(func, ret);
            return ret;
        }
        function removeFunctionWasm(index) {
            functionsInTableMap.delete(wasmTable.get(index));
            freeTableIndexes.push(index);
        }
        function addFunction(func, sig) {
            return addFunctionWasm(func, sig);
        }
        function removeFunction(index) {
            removeFunctionWasm(index);
        }
        var tempRet0 = 0;
        var setTempRet0 = function (value) {
            tempRet0 = value;
        };
        var getTempRet0 = function () {
            return tempRet0;
        };
        var wasmBinary;
        if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
        var noExitRuntime;
        if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
        if (typeof WebAssembly !== "object") {
            err("no native wasm support detected");
        }
        function setValue(ptr, value, type, noSafe) {
            type = type || "i8";
            if (type.charAt(type.length - 1) === "*") type = "i32";
            switch (type) {
                case "i1":
                    HEAP8[ptr >> 0] = value;
                    break;
                case "i8":
                    HEAP8[ptr >> 0] = value;
                    break;
                case "i16":
                    HEAP16[ptr >> 1] = value;
                    break;
                case "i32":
                    HEAP32[ptr >> 2] = value;
                    break;
                case "i64":
                    (tempI64 = [
                        value >>> 0,
                        ((tempDouble = value),
                        +Math_abs(tempDouble) >= 1 ? (tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0) : 0),
                    ]),
                        (HEAP32[ptr >> 2] = tempI64[0]),
                        (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
                    break;
                case "float":
                    HEAPF32[ptr >> 2] = value;
                    break;
                case "double":
                    HEAPF64[ptr >> 3] = value;
                    break;
                default:
                    abort("invalid type for setValue: " + type);
            }
        }
        function getValue(ptr, type, noSafe) {
            type = type || "i8";
            if (type.charAt(type.length - 1) === "*") type = "i32";
            switch (type) {
                case "i1":
                    return HEAP8[ptr >> 0];
                case "i8":
                    return HEAP8[ptr >> 0];
                case "i16":
                    return HEAP16[ptr >> 1];
                case "i32":
                    return HEAP32[ptr >> 2];
                case "i64":
                    return HEAP32[ptr >> 2];
                case "float":
                    return HEAPF32[ptr >> 2];
                case "double":
                    return HEAPF64[ptr >> 3];
                default:
                    abort("invalid type for getValue: " + type);
            }
            return null;
        }
        var wasmMemory;
        var wasmTable = new WebAssembly.Table({ initial: 462, element: "anyfunc" });
        var ABORT = false;
        var EXITSTATUS = 0;
        function assert(condition, text) {
            if (!condition) {
                abort("Assertion failed: " + text);
            }
        }
        function getCFunc(ident) {
            var func = Module["_" + ident];
            assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
            return func;
        }
        function ccall(ident, returnType, argTypes, args, opts) {
            var toC = {
                string: function (str) {
                    var ret = 0;
                    if (str !== null && str !== undefined && str !== 0) {
                        var len = (str.length << 2) + 1;
                        ret = stackAlloc(len);
                        stringToUTF8(str, ret, len);
                    }
                    return ret;
                },
                array: function (arr) {
                    var ret = stackAlloc(arr.length);
                    writeArrayToMemory(arr, ret);
                    return ret;
                },
            };
            function convertReturnValue(ret) {
                if (returnType === "string") return UTF8ToString(ret);
                if (returnType === "boolean") return Boolean(ret);
                return ret;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            if (args) {
                for (var i = 0; i < args.length; i++) {
                    var converter = toC[argTypes[i]];
                    if (converter) {
                        if (stack === 0) stack = stackSave();
                        cArgs[i] = converter(args[i]);
                    } else {
                        cArgs[i] = args[i];
                    }
                }
            }
            var ret = func.apply(null, cArgs);
            ret = convertReturnValue(ret);
            if (stack !== 0) stackRestore(stack);
            return ret;
        }
        function cwrap(ident, returnType, argTypes, opts) {
            argTypes = argTypes || [];
            var numericArgs = argTypes.every(function (type) {
                return type === "number";
            });
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs && !opts) {
                return getCFunc(ident);
            }
            return function () {
                return ccall(ident, returnType, argTypes, arguments, opts);
            };
        }
        var ALLOC_NORMAL = 0;
        var ALLOC_NONE = 3;
        function allocate(slab, types, allocator, ptr) {
            var zeroinit, size;
            if (typeof slab === "number") {
                zeroinit = true;
                size = slab;
            } else {
                zeroinit = false;
                size = slab.length;
            }
            var singleType = typeof types === "string" ? types : null;
            var ret;
            if (allocator == ALLOC_NONE) {
                ret = ptr;
            } else {
                ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
            }
            if (zeroinit) {
                var stop;
                ptr = ret;
                assert((ret & 3) == 0);
                stop = ret + (size & ~3);
                for (; ptr < stop; ptr += 4) {
                    HEAP32[ptr >> 2] = 0;
                }
                stop = ret + size;
                while (ptr < stop) {
                    HEAP8[ptr++ >> 0] = 0;
                }
                return ret;
            }
            if (singleType === "i8") {
                if (slab.subarray || slab.slice) {
                    HEAPU8.set(slab, ret);
                } else {
                    HEAPU8.set(new Uint8Array(slab), ret);
                }
                return ret;
            }
            var i = 0,
                type,
                typeSize,
                previousType;
            while (i < size) {
                var curr = slab[i];
                type = singleType || types[i];
                if (type === 0) {
                    i++;
                    continue;
                }
                if (type == "i64") type = "i32";
                setValue(ret + i, curr, type);
                if (previousType !== type) {
                    typeSize = getNativeTypeSize(type);
                    previousType = type;
                }
                i += typeSize;
            }
            return ret;
        }
        var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
        function UTF8ArrayToString(heap, idx, maxBytesToRead) {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
                return UTF8Decoder.decode(heap.subarray(idx, endPtr));
            } else {
                var str = "";
                while (idx < endPtr) {
                    var u0 = heap[idx++];
                    if (!(u0 & 128)) {
                        str += String.fromCharCode(u0);
                        continue;
                    }
                    var u1 = heap[idx++] & 63;
                    if ((u0 & 224) == 192) {
                        str += String.fromCharCode(((u0 & 31) << 6) | u1);
                        continue;
                    }
                    var u2 = heap[idx++] & 63;
                    if ((u0 & 240) == 224) {
                        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
                    } else {
                        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
                    }
                    if (u0 < 65536) {
                        str += String.fromCharCode(u0);
                    } else {
                        var ch = u0 - 65536;
                        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
                    }
                }
            }
            return str;
        }
        function UTF8ToString(ptr, maxBytesToRead) {
            return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
        }
        function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
                var u = str.charCodeAt(i);
                if (u >= 55296 && u <= 57343) {
                    var u1 = str.charCodeAt(++i);
                    u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
                }
                if (u <= 127) {
                    if (outIdx >= endIdx) break;
                    heap[outIdx++] = u;
                } else if (u <= 2047) {
                    if (outIdx + 1 >= endIdx) break;
                    heap[outIdx++] = 192 | (u >> 6);
                    heap[outIdx++] = 128 | (u & 63);
                } else if (u <= 65535) {
                    if (outIdx + 2 >= endIdx) break;
                    heap[outIdx++] = 224 | (u >> 12);
                    heap[outIdx++] = 128 | ((u >> 6) & 63);
                    heap[outIdx++] = 128 | (u & 63);
                } else {
                    if (outIdx + 3 >= endIdx) break;
                    heap[outIdx++] = 240 | (u >> 18);
                    heap[outIdx++] = 128 | ((u >> 12) & 63);
                    heap[outIdx++] = 128 | ((u >> 6) & 63);
                    heap[outIdx++] = 128 | (u & 63);
                }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
        }
        function stringToUTF8(str, outPtr, maxBytesToWrite) {
            return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
        }
        function lengthBytesUTF8(str) {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
                var u = str.charCodeAt(i);
                if (u >= 55296 && u <= 57343) u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
                if (u <= 127) ++len;
                else if (u <= 2047) len += 2;
                else if (u <= 65535) len += 3;
                else len += 4;
            }
            return len;
        }
        function writeArrayToMemory(array, buffer) {
            HEAP8.set(array, buffer);
        }
        function writeAsciiToMemory(str, buffer, dontAddNull) {
            for (var i = 0; i < str.length; ++i) {
                HEAP8[buffer++ >> 0] = str.charCodeAt(i);
            }
            if (!dontAddNull) HEAP8[buffer >> 0] = 0;
        }
        var WASM_PAGE_SIZE = 65536;
        function alignUp(x, multiple) {
            if (x % multiple > 0) {
                x += multiple - (x % multiple);
            }
            return x;
        }
        var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        function updateGlobalBufferAndViews(buf) {
            buffer = buf;
            Module["HEAP8"] = HEAP8 = new Int8Array(buf);
            Module["HEAP16"] = HEAP16 = new Int16Array(buf);
            Module["HEAP32"] = HEAP32 = new Int32Array(buf);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
        }
        var DYNAMIC_BASE = 5808256,
            DYNAMICTOP_PTR = 565216;
        var INITIAL_INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
        if (Module["wasmMemory"]) {
            wasmMemory = Module["wasmMemory"];
        } else {
            wasmMemory = new WebAssembly.Memory({ initial: INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE, maximum: 2147483648 / WASM_PAGE_SIZE });
        }
        if (wasmMemory) {
            buffer = wasmMemory.buffer;
        }
        INITIAL_INITIAL_MEMORY = buffer.byteLength;
        updateGlobalBufferAndViews(buffer);
        HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
        function callRuntimeCallbacks(callbacks) {
            while (callbacks.length > 0) {
                var callback = callbacks.shift();
                if (typeof callback == "function") {
                    callback(Module);
                    continue;
                }
                var func = callback.func;
                if (typeof func === "number") {
                    if (callback.arg === undefined) {
                        Module["dynCall_v"](func);
                    } else {
                        Module["dynCall_vi"](func, callback.arg);
                    }
                } else {
                    func(callback.arg === undefined ? null : callback.arg);
                }
            }
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeInitialized = false;
        var runtimeExited = false;
        function preRun() {
            if (Module["preRun"]) {
                if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
                while (Module["preRun"].length) {
                    addOnPreRun(Module["preRun"].shift());
                }
            }
            callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__);
        }
        function preMain() {
            callRuntimeCallbacks(__ATMAIN__);
        }
        function exitRuntime() {
            runtimeExited = true;
        }
        function postRun() {
            if (Module["postRun"]) {
                if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
                while (Module["postRun"].length) {
                    addOnPostRun(Module["postRun"].shift());
                }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
        }
        function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
        }
        var Math_abs = Math.abs;
        var Math_ceil = Math.ceil;
        var Math_floor = Math.floor;
        var Math_min = Math.min;
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
            return id;
        }
        function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies);
            }
        }
        function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies);
            }
            if (runDependencies == 0) {
                if (runDependencyWatcher !== null) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null;
                }
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback();
                }
            }
        }
        Module["preloadedImages"] = {};
        Module["preloadedAudios"] = {};
        function abort(what) {
            if (Module["onAbort"]) {
                Module["onAbort"](what);
            }
            what += "";
            out(what);
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
            throw new WebAssembly.RuntimeError(what);
        }
        function hasPrefix(str, prefix) {
            return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        function isDataURI(filename) {
            return hasPrefix(filename, dataURIPrefix);
        }
        var fileURIPrefix = "file://";
        function isFileURI(filename) {
            return hasPrefix(filename, fileURIPrefix);
        }
        var wasmBinaryFile = "stellarium-web-engine.wasm";
        if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinary() {
            try {
                if (wasmBinary) {
                    return new Uint8Array(wasmBinary);
                }
                if (readBinary) {
                    return readBinary(wasmBinaryFile);
                } else {
                    throw "both async and sync fetching of the wasm failed";
                }
            } catch (err) {
                abort(err);
            }
        }
        function getBinaryPromise() {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
                return fetch(wasmBinaryFile, { credentials: "same-origin" })
                    .then(function (response) {
                        if (!response["ok"]) {
                            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                        }
                        return response["arrayBuffer"]();
                    })
                    .catch(function () {
                        return getBinary();
                    });
            }
            return new Promise(function (resolve, reject) {
                resolve(getBinary());
            });
        }
        function createWasm() {
            var info = { a: asmLibraryArg };
            function receiveInstance(instance, module) {
                var exports = instance.exports;
                Module["asm"] = exports;
                removeRunDependency("wasm-instantiate");
            }
            addRunDependency("wasm-instantiate");
            function receiveInstantiatedSource(output) {
                receiveInstance(output["instance"]);
            }
            function instantiateArrayBuffer(receiver) {
                return getBinaryPromise()
                    .then(function (binary) {
                        return WebAssembly.instantiate(binary, info);
                    })
                    .then(receiver, function (reason) {
                        err("failed to asynchronously prepare wasm: " + reason);
                        abort(reason);
                    });
            }
            function instantiateAsync() {
                if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
                    fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function (response) {
                        var result = WebAssembly.instantiateStreaming(response, info);
                        return result.then(receiveInstantiatedSource, function (reason) {
                            err("wasm streaming compile failed: " + reason);
                            err("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(receiveInstantiatedSource);
                        });
                    });
                } else {
                    return instantiateArrayBuffer(receiveInstantiatedSource);
                }
            }
            if (Module["instantiateWasm"]) {
                try {
                    var exports = Module["instantiateWasm"](info, receiveInstance);
                    return exports;
                } catch (e) {
                    err("Module.instantiateWasm callback failed with error: " + e);
                    return false;
                }
            }
            instantiateAsync();
            return {};
        }
        var tempDouble;
        var tempI64;
        __ATINIT__.push({
            func: function () {
                ___wasm_call_ctors();
            },
        });
        function _emscripten_set_main_loop_timing(mode, value) {
            Browser.mainLoop.timingMode = mode;
            Browser.mainLoop.timingValue = value;
            if (!Browser.mainLoop.func) {
                return 1;
            }
            if (mode == 0) {
                Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
                    var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
                    setTimeout(Browser.mainLoop.runner, timeUntilNextTick);
                };
                Browser.mainLoop.method = "timeout";
            } else if (mode == 1) {
                Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
                    Browser.requestAnimationFrame(Browser.mainLoop.runner);
                };
                Browser.mainLoop.method = "rAF";
            } else if (mode == 2) {
                if (typeof setImmediate === "undefined") {
                    var setImmediates = [];
                    var emscriptenMainLoopMessageId = "setimmediate";
                    var Browser_setImmediate_messageHandler = function (event) {
                        if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                            event.stopPropagation();
                            setImmediates.shift()();
                        }
                    };
                    addEventListener("message", Browser_setImmediate_messageHandler, true);
                    setImmediate = function Browser_emulated_setImmediate(func) {
                        setImmediates.push(func);
                        if (ENVIRONMENT_IS_WORKER) {
                            if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
                            Module["setImmediates"].push(func);
                            postMessage({ target: emscriptenMainLoopMessageId });
                        } else postMessage(emscriptenMainLoopMessageId, "*");
                    };
                }
                Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
                    setImmediate(Browser.mainLoop.runner);
                };
                Browser.mainLoop.method = "immediate";
            }
            return 0;
        }
        var _emscripten_get_now;
        if (ENVIRONMENT_IS_NODE) {
            _emscripten_get_now = function () {
                var t = process["hrtime"]();
                return t[0] * 1e3 + t[1] / 1e6;
            };
        } else if (typeof dateNow !== "undefined") {
            _emscripten_get_now = dateNow;
        } else
            _emscripten_get_now = function () {
                return performance.now();
            };
        function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
            noExitRuntime = true;
            assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
            Browser.mainLoop.func = func;
            Browser.mainLoop.arg = arg;
            var browserIterationFunc;
            if (typeof arg !== "undefined") {
                browserIterationFunc = function () {
                    Module["dynCall_vi"](func, arg);
                };
            } else {
                browserIterationFunc = function () {
                    Module["dynCall_v"](func);
                };
            }
            var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
            Browser.mainLoop.runner = function Browser_mainLoop_runner() {
                if (ABORT) return;
                if (Browser.mainLoop.queue.length > 0) {
                    var start = Date.now();
                    var blocker = Browser.mainLoop.queue.shift();
                    blocker.func(blocker.arg);
                    if (Browser.mainLoop.remainingBlockers) {
                        var remaining = Browser.mainLoop.remainingBlockers;
                        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
                        if (blocker.counted) {
                            Browser.mainLoop.remainingBlockers = next;
                        } else {
                            next = next + 0.5;
                            Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
                        }
                    }
                    console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
                    Browser.mainLoop.updateStatus();
                    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                    setTimeout(Browser.mainLoop.runner, 0);
                    return;
                }
                if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                Browser.mainLoop.currentFrameNumber = (Browser.mainLoop.currentFrameNumber + 1) | 0;
                if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
                    Browser.mainLoop.scheduler();
                    return;
                } else if (Browser.mainLoop.timingMode == 0) {
                    Browser.mainLoop.tickStartTime = _emscripten_get_now();
                }
                Browser.mainLoop.runIter(browserIterationFunc);
                if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
                Browser.mainLoop.scheduler();
            };
            if (!noSetTiming) {
                if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
                else _emscripten_set_main_loop_timing(1, 1);
                Browser.mainLoop.scheduler();
            }
            if (simulateInfiniteLoop) {
                throw "unwind";
            }
        }
        var Browser = {
            mainLoop: {
                scheduler: null,
                method: "",
                currentlyRunningMainloop: 0,
                func: null,
                arg: 0,
                timingMode: 0,
                timingValue: 0,
                currentFrameNumber: 0,
                queue: [],
                pause: function () {
                    Browser.mainLoop.scheduler = null;
                    Browser.mainLoop.currentlyRunningMainloop++;
                },
                resume: function () {
                    Browser.mainLoop.currentlyRunningMainloop++;
                    var timingMode = Browser.mainLoop.timingMode;
                    var timingValue = Browser.mainLoop.timingValue;
                    var func = Browser.mainLoop.func;
                    Browser.mainLoop.func = null;
                    _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
                    _emscripten_set_main_loop_timing(timingMode, timingValue);
                    Browser.mainLoop.scheduler();
                },
                updateStatus: function () {
                    if (Module["setStatus"]) {
                        var message = Module["statusMessage"] || "Please wait...";
                        var remaining = Browser.mainLoop.remainingBlockers;
                        var expected = Browser.mainLoop.expectedBlockers;
                        if (remaining) {
                            if (remaining < expected) {
                                Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
                            } else {
                                Module["setStatus"](message);
                            }
                        } else {
                            Module["setStatus"]("");
                        }
                    }
                },
                runIter: function (func) {
                    if (ABORT) return;
                    if (Module["preMainLoop"]) {
                        var preRet = Module["preMainLoop"]();
                        if (preRet === false) {
                            return;
                        }
                    }
                    try {
                        func();
                    } catch (e) {
                        if (e instanceof ExitStatus) {
                            return;
                        } else {
                            if (e && typeof e === "object" && e.stack) err("exception thrown: " + [e, e.stack]);
                            throw e;
                        }
                    }
                    if (Module["postMainLoop"]) Module["postMainLoop"]();
                },
            },
            isFullscreen: false,
            pointerLock: false,
            moduleContextCreatedCallbacks: [],
            workers: [],
            init: function () {
                if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
                if (Browser.initted) return;
                Browser.initted = true;
                try {
                    new Blob();
                    Browser.hasBlobConstructor = true;
                } catch (e) {
                    Browser.hasBlobConstructor = false;
                    console.log("warning: no blob constructor, cannot create blobs with mimetypes");
                }
                Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
                Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
                if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
                    console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
                    Module.noImageDecoding = true;
                }
                var imagePlugin = {};
                imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
                    return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
                };
                imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
                    var b = null;
                    if (Browser.hasBlobConstructor) {
                        try {
                            b = new Blob([byteArray], { type: Browser.getMimetype(name) });
                            if (b.size !== byteArray.length) {
                                b = new Blob([new Uint8Array(byteArray).buffer], { type: Browser.getMimetype(name) });
                            }
                        } catch (e) {
                            warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
                        }
                    }
                    if (!b) {
                        var bb = new Browser.BlobBuilder();
                        bb.append(new Uint8Array(byteArray).buffer);
                        b = bb.getBlob();
                    }
                    var url = Browser.URLObject.createObjectURL(b);
                    var img = new Image();
                    img.onload = function img_onload() {
                        assert(img.complete, "Image " + name + " could not be decoded");
                        var canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        var ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0);
                        Module["preloadedImages"][name] = canvas;
                        Browser.URLObject.revokeObjectURL(url);
                        if (onload) onload(byteArray);
                    };
                    img.onerror = function img_onerror(event) {
                        console.log("Image " + url + " could not be decoded");
                        if (onerror) onerror();
                    };
                    img.src = url;
                };
                Module["preloadPlugins"].push(imagePlugin);
                var audioPlugin = {};
                audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
                    return !Module.noAudioDecoding && name.substr(-4) in { ".ogg": 1, ".wav": 1, ".mp3": 1 };
                };
                audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
                    var done = false;
                    function finish(audio) {
                        if (done) return;
                        done = true;
                        Module["preloadedAudios"][name] = audio;
                        if (onload) onload(byteArray);
                    }
                    function fail() {
                        if (done) return;
                        done = true;
                        Module["preloadedAudios"][name] = new Audio();
                        if (onerror) onerror();
                    }
                    if (Browser.hasBlobConstructor) {
                        try {
                            var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
                        } catch (e) {
                            return fail();
                        }
                        var url = Browser.URLObject.createObjectURL(b);
                        var audio = new Audio();
                        audio.addEventListener(
                            "canplaythrough",
                            function () {
                                finish(audio);
                            },
                            false
                        );
                        audio.onerror = function audio_onerror(event) {
                            if (done) return;
                            console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
                            function encode64(data) {
                                var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                                var PAD = "=";
                                var ret = "";
                                var leftchar = 0;
                                var leftbits = 0;
                                for (var i = 0; i < data.length; i++) {
                                    leftchar = (leftchar << 8) | data[i];
                                    leftbits += 8;
                                    while (leftbits >= 6) {
                                        var curr = (leftchar >> (leftbits - 6)) & 63;
                                        leftbits -= 6;
                                        ret += BASE[curr];
                                    }
                                }
                                if (leftbits == 2) {
                                    ret += BASE[(leftchar & 3) << 4];
                                    ret += PAD + PAD;
                                } else if (leftbits == 4) {
                                    ret += BASE[(leftchar & 15) << 2];
                                    ret += PAD;
                                }
                                return ret;
                            }
                            audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
                            finish(audio);
                        };
                        audio.src = url;
                        Browser.safeSetTimeout(function () {
                            finish(audio);
                        }, 1e4);
                    } else {
                        return fail();
                    }
                };
                Module["preloadPlugins"].push(audioPlugin);
                function pointerLockChange() {
                    Browser.pointerLock =
                        document["pointerLockElement"] === Module["canvas"] ||
                        document["mozPointerLockElement"] === Module["canvas"] ||
                        document["webkitPointerLockElement"] === Module["canvas"] ||
                        document["msPointerLockElement"] === Module["canvas"];
                }
                var canvas = Module["canvas"];
                if (canvas) {
                    canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function () {};
                    canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function () {};
                    canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
                    document.addEventListener("pointerlockchange", pointerLockChange, false);
                    document.addEventListener("mozpointerlockchange", pointerLockChange, false);
                    document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
                    document.addEventListener("mspointerlockchange", pointerLockChange, false);
                    if (Module["elementPointerLock"]) {
                        canvas.addEventListener(
                            "click",
                            function (ev) {
                                if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
                                    Module["canvas"].requestPointerLock();
                                    ev.preventDefault();
                                }
                            },
                            false
                        );
                    }
                }
            },
            createContext: function (canvas, useWebGL, setInModule, webGLContextAttributes) {
                if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
                var ctx;
                var contextHandle;
                if (useWebGL) {
                    var contextAttributes = { antialias: false, alpha: false, majorVersion: typeof WebGL2RenderingContext !== "undefined" ? 2 : 1 };
                    if (webGLContextAttributes) {
                        for (var attribute in webGLContextAttributes) {
                            contextAttributes[attribute] = webGLContextAttributes[attribute];
                        }
                    }
                    if (typeof GL !== "undefined") {
                        contextHandle = GL.createContext(canvas, contextAttributes);
                        if (contextHandle) {
                            ctx = GL.getContext(contextHandle).GLctx;
                        }
                    }
                } else {
                    ctx = canvas.getContext("2d");
                }
                if (!ctx) return null;
                if (setInModule) {
                    if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
                    Module.ctx = ctx;
                    if (useWebGL) GL.makeContextCurrent(contextHandle);
                    Module.useWebGL = useWebGL;
                    Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
                        callback();
                    });
                    Browser.init();
                }
                return ctx;
            },
            destroyContext: function (canvas, useWebGL, setInModule) {},
            fullscreenHandlersInstalled: false,
            lockPointer: undefined,
            resizeCanvas: undefined,
            requestFullscreen: function (lockPointer, resizeCanvas) {
                Browser.lockPointer = lockPointer;
                Browser.resizeCanvas = resizeCanvas;
                if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
                if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
                var canvas = Module["canvas"];
                function fullscreenChange() {
                    Browser.isFullscreen = false;
                    var canvasContainer = canvas.parentNode;
                    if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
                        canvas.exitFullscreen = Browser.exitFullscreen;
                        if (Browser.lockPointer) canvas.requestPointerLock();
                        Browser.isFullscreen = true;
                        if (Browser.resizeCanvas) {
                            Browser.setFullscreenCanvasSize();
                        } else {
                            Browser.updateCanvasDimensions(canvas);
                        }
                    } else {
                        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
                        canvasContainer.parentNode.removeChild(canvasContainer);
                        if (Browser.resizeCanvas) {
                            Browser.setWindowedCanvasSize();
                        } else {
                            Browser.updateCanvasDimensions(canvas);
                        }
                    }
                    if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
                    if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen);
                }
                if (!Browser.fullscreenHandlersInstalled) {
                    Browser.fullscreenHandlersInstalled = true;
                    document.addEventListener("fullscreenchange", fullscreenChange, false);
                    document.addEventListener("mozfullscreenchange", fullscreenChange, false);
                    document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
                    document.addEventListener("MSFullscreenChange", fullscreenChange, false);
                }
                var canvasContainer = document.createElement("div");
                canvas.parentNode.insertBefore(canvasContainer, canvas);
                canvasContainer.appendChild(canvas);
                canvasContainer.requestFullscreen =
                    canvasContainer["requestFullscreen"] ||
                    canvasContainer["mozRequestFullScreen"] ||
                    canvasContainer["msRequestFullscreen"] ||
                    (canvasContainer["webkitRequestFullscreen"]
                        ? function () {
                              canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]);
                          }
                        : null) ||
                    (canvasContainer["webkitRequestFullScreen"]
                        ? function () {
                              canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
                          }
                        : null);
                canvasContainer.requestFullscreen();
            },
            exitFullscreen: function () {
                if (!Browser.isFullscreen) {
                    return false;
                }
                var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function () {};
                CFS.apply(document, []);
                return true;
            },
            nextRAF: 0,
            fakeRequestAnimationFrame: function (func) {
                var now = Date.now();
                if (Browser.nextRAF === 0) {
                    Browser.nextRAF = now + 1e3 / 60;
                } else {
                    while (now + 2 >= Browser.nextRAF) {
                        Browser.nextRAF += 1e3 / 60;
                    }
                }
                var delay = Math.max(Browser.nextRAF - now, 0);
                setTimeout(func, delay);
            },
            requestAnimationFrame: function (func) {
                if (typeof requestAnimationFrame === "function") {
                    requestAnimationFrame(func);
                    return;
                }
                var RAF = Browser.fakeRequestAnimationFrame;
                RAF(func);
            },
            safeCallback: function (func) {
                return function () {
                    if (!ABORT) return func.apply(null, arguments);
                };
            },
            allowAsyncCallbacks: true,
            queuedAsyncCallbacks: [],
            pauseAsyncCallbacks: function () {
                Browser.allowAsyncCallbacks = false;
            },
            resumeAsyncCallbacks: function () {
                Browser.allowAsyncCallbacks = true;
                if (Browser.queuedAsyncCallbacks.length > 0) {
                    var callbacks = Browser.queuedAsyncCallbacks;
                    Browser.queuedAsyncCallbacks = [];
                    callbacks.forEach(function (func) {
                        func();
                    });
                }
            },
            safeRequestAnimationFrame: function (func) {
                return Browser.requestAnimationFrame(function () {
                    if (ABORT) return;
                    if (Browser.allowAsyncCallbacks) {
                        func();
                    } else {
                        Browser.queuedAsyncCallbacks.push(func);
                    }
                });
            },
            safeSetTimeout: function (func, timeout) {
                noExitRuntime = true;
                return setTimeout(function () {
                    if (ABORT) return;
                    if (Browser.allowAsyncCallbacks) {
                        func();
                    } else {
                        Browser.queuedAsyncCallbacks.push(func);
                    }
                }, timeout);
            },
            safeSetInterval: function (func, timeout) {
                noExitRuntime = true;
                return setInterval(function () {
                    if (ABORT) return;
                    if (Browser.allowAsyncCallbacks) {
                        func();
                    }
                }, timeout);
            },
            getMimetype: function (name) {
                return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", bmp: "image/bmp", ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg" }[name.substr(name.lastIndexOf(".") + 1)];
            },
            getUserMedia: function (func) {
                if (!window.getUserMedia) {
                    window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
                }
                window.getUserMedia(func);
            },
            getMovementX: function (event) {
                return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
            },
            getMovementY: function (event) {
                return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
            },
            getMouseWheelDelta: function (event) {
                var delta = 0;
                switch (event.type) {
                    case "DOMMouseScroll":
                        delta = event.detail / 3;
                        break;
                    case "mousewheel":
                        delta = event.wheelDelta / 120;
                        break;
                    case "wheel":
                        delta = event.deltaY;
                        switch (event.deltaMode) {
                            case 0:
                                delta /= 100;
                                break;
                            case 1:
                                delta /= 3;
                                break;
                            case 2:
                                delta *= 80;
                                break;
                            default:
                                throw "unrecognized mouse wheel delta mode: " + event.deltaMode;
                        }
                        break;
                    default:
                        throw "unrecognized mouse wheel event: " + event.type;
                }
                return delta;
            },
            mouseX: 0,
            mouseY: 0,
            mouseMovementX: 0,
            mouseMovementY: 0,
            touches: {},
            lastTouches: {},
            calculateMouseEvent: function (event) {
                if (Browser.pointerLock) {
                    if (event.type != "mousemove" && "mozMovementX" in event) {
                        Browser.mouseMovementX = Browser.mouseMovementY = 0;
                    } else {
                        Browser.mouseMovementX = Browser.getMovementX(event);
                        Browser.mouseMovementY = Browser.getMovementY(event);
                    }
                    if (typeof SDL != "undefined") {
                        Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
                        Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
                    } else {
                        Browser.mouseX += Browser.mouseMovementX;
                        Browser.mouseY += Browser.mouseMovementY;
                    }
                } else {
                    var rect = Module["canvas"].getBoundingClientRect();
                    var cw = Module["canvas"].width;
                    var ch = Module["canvas"].height;
                    var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
                    var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
                    if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
                        var touch = event.touch;
                        if (touch === undefined) {
                            return;
                        }
                        var adjustedX = touch.pageX - (scrollX + rect.left);
                        var adjustedY = touch.pageY - (scrollY + rect.top);
                        adjustedX = adjustedX * (cw / rect.width);
                        adjustedY = adjustedY * (ch / rect.height);
                        var coords = { x: adjustedX, y: adjustedY };
                        if (event.type === "touchstart") {
                            Browser.lastTouches[touch.identifier] = coords;
                            Browser.touches[touch.identifier] = coords;
                        } else if (event.type === "touchend" || event.type === "touchmove") {
                            var last = Browser.touches[touch.identifier];
                            if (!last) last = coords;
                            Browser.lastTouches[touch.identifier] = last;
                            Browser.touches[touch.identifier] = coords;
                        }
                        return;
                    }
                    var x = event.pageX - (scrollX + rect.left);
                    var y = event.pageY - (scrollY + rect.top);
                    x = x * (cw / rect.width);
                    y = y * (ch / rect.height);
                    Browser.mouseMovementX = x - Browser.mouseX;
                    Browser.mouseMovementY = y - Browser.mouseY;
                    Browser.mouseX = x;
                    Browser.mouseY = y;
                }
            },
            asyncLoad: function (url, onload, onerror, noRunDep) {
                var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
                readAsync(
                    url,
                    function (arrayBuffer) {
                        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
                        onload(new Uint8Array(arrayBuffer));
                        if (dep) removeRunDependency(dep);
                    },
                    function (event) {
                        if (onerror) {
                            onerror();
                        } else {
                            throw 'Loading data file "' + url + '" failed.';
                        }
                    }
                );
                if (dep) addRunDependency(dep);
            },
            resizeListeners: [],
            updateResizeListeners: function () {
                var canvas = Module["canvas"];
                Browser.resizeListeners.forEach(function (listener) {
                    listener(canvas.width, canvas.height);
                });
            },
            setCanvasSize: function (width, height, noUpdates) {
                var canvas = Module["canvas"];
                Browser.updateCanvasDimensions(canvas, width, height);
                if (!noUpdates) Browser.updateResizeListeners();
            },
            windowedWidth: 0,
            windowedHeight: 0,
            setFullscreenCanvasSize: function () {
                if (typeof SDL != "undefined") {
                    var flags = HEAPU32[SDL.screen >> 2];
                    flags = flags | 8388608;
                    HEAP32[SDL.screen >> 2] = flags;
                }
                Browser.updateCanvasDimensions(Module["canvas"]);
                Browser.updateResizeListeners();
            },
            setWindowedCanvasSize: function () {
                if (typeof SDL != "undefined") {
                    var flags = HEAPU32[SDL.screen >> 2];
                    flags = flags & ~8388608;
                    HEAP32[SDL.screen >> 2] = flags;
                }
                Browser.updateCanvasDimensions(Module["canvas"]);
                Browser.updateResizeListeners();
            },
            updateCanvasDimensions: function (canvas, wNative, hNative) {
                if (wNative && hNative) {
                    canvas.widthNative = wNative;
                    canvas.heightNative = hNative;
                } else {
                    wNative = canvas.widthNative;
                    hNative = canvas.heightNative;
                }
                var w = wNative;
                var h = hNative;
                if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
                    if (w / h < Module["forcedAspectRatio"]) {
                        w = Math.round(h * Module["forcedAspectRatio"]);
                    } else {
                        h = Math.round(w / Module["forcedAspectRatio"]);
                    }
                }
                if (
                    (document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode &&
                    typeof screen != "undefined"
                ) {
                    var factor = Math.min(screen.width / w, screen.height / h);
                    w = Math.round(w * factor);
                    h = Math.round(h * factor);
                }
                if (Browser.resizeCanvas) {
                    if (canvas.width != w) canvas.width = w;
                    if (canvas.height != h) canvas.height = h;
                    if (typeof canvas.style != "undefined") {
                        canvas.style.removeProperty("width");
                        canvas.style.removeProperty("height");
                    }
                } else {
                    if (canvas.width != wNative) canvas.width = wNative;
                    if (canvas.height != hNative) canvas.height = hNative;
                    if (typeof canvas.style != "undefined") {
                        if (w != wNative || h != hNative) {
                            canvas.style.setProperty("width", w + "px", "important");
                            canvas.style.setProperty("height", h + "px", "important");
                        } else {
                            canvas.style.removeProperty("width");
                            canvas.style.removeProperty("height");
                        }
                    }
                }
            },
            wgetRequests: {},
            nextWgetRequestHandle: 0,
            getNextWgetRequestHandle: function () {
                var handle = Browser.nextWgetRequestHandle;
                Browser.nextWgetRequestHandle++;
                return handle;
            },
        };
        function _emscripten_async_wget2_abort(handle) {
            var http = Browser.wgetRequests[handle];
            if (http) {
                http.abort();
            }
        }
        function _emscripten_async_wget2_data(url, request, param, arg, free, onload, onerror, onprogress) {
            var _url = UTF8ToString(url);
            var _request = UTF8ToString(request);
            var _param = UTF8ToString(param);
            var http = new XMLHttpRequest();
            http.open(_request, _url, true);
            http.responseType = "arraybuffer";
            var handle = Browser.getNextWgetRequestHandle();
            http.onload = function http_onload(e) {
                if ((http.status >= 200 && http.status < 300) || (http.status === 0 && _url.substr(0, 4).toLowerCase() != "http")) {
                    var byteArray = new Uint8Array(http.response);
                    var buffer = _malloc(byteArray.length);
                    HEAPU8.set(byteArray, buffer);
                    if (onload) dynCall_viiii(onload, handle, arg, buffer, byteArray.length);
                    if (free) _free(buffer);
                } else {
                    if (onerror) dynCall_viiii(onerror, handle, arg, http.status, http.statusText);
                }
                delete Browser.wgetRequests[handle];
            };
            http.onerror = function http_onerror(e) {
                if (onerror) {
                    dynCall_viiii(onerror, handle, arg, http.status, http.statusText);
                }
                delete Browser.wgetRequests[handle];
            };
            http.onprogress = function http_onprogress(e) {
                if (onprogress) dynCall_viiii(onprogress, handle, arg, e.loaded, e.lengthComputable || e.lengthComputable === undefined ? e.total : 0);
            };
            http.onabort = function http_onabort(e) {
                delete Browser.wgetRequests[handle];
            };
            if (_request == "POST") {
                http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                http.send(_param);
            } else {
                http.send(null);
            }
            Browser.wgetRequests[handle] = http;
            return handle;
        }
        function _longjmp(env, value) {
            _setThrew(env, value || 1);
            throw "longjmp";
        }
        function _emscripten_longjmp(env, value) {
            _longjmp(env, value);
        }
        function _emscripten_memcpy_big(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num);
        }
        function _emscripten_get_heap_size() {
            return HEAPU8.length;
        }
        function emscripten_realloc_buffer(size) {
            try {
                wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16);
                updateGlobalBufferAndViews(wasmMemory.buffer);
                return 1;
            } catch (e) {}
        }
        function _emscripten_resize_heap(requestedSize) {
            requestedSize = requestedSize >>> 0;
            var oldSize = _emscripten_get_heap_size();
            var PAGE_MULTIPLE = 65536;
            var maxHeapSize = 2147483648;
            if (requestedSize > maxHeapSize) {
                return false;
            }
            var minHeapSize = 16777216;
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
                overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
                var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), PAGE_MULTIPLE));
                var replacement = emscripten_realloc_buffer(newSize);
                if (replacement) {
                    return true;
                }
            }
            return false;
        }
        function _exit(status) {
            exit(status);
        }
        var PATH = {
            splitPath: function (filename) {
                var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                return splitPathRe.exec(filename).slice(1);
            },
            normalizeArray: function (parts, allowAboveRoot) {
                var up = 0;
                for (var i = parts.length - 1; i >= 0; i--) {
                    var last = parts[i];
                    if (last === ".") {
                        parts.splice(i, 1);
                    } else if (last === "..") {
                        parts.splice(i, 1);
                        up++;
                    } else if (up) {
                        parts.splice(i, 1);
                        up--;
                    }
                }
                if (allowAboveRoot) {
                    for (; up; up--) {
                        parts.unshift("..");
                    }
                }
                return parts;
            },
            normalize: function (path) {
                var isAbsolute = path.charAt(0) === "/",
                    trailingSlash = path.substr(-1) === "/";
                path = PATH.normalizeArray(
                    path.split("/").filter(function (p) {
                        return !!p;
                    }),
                    !isAbsolute
                ).join("/");
                if (!path && !isAbsolute) {
                    path = ".";
                }
                if (path && trailingSlash) {
                    path += "/";
                }
                return (isAbsolute ? "/" : "") + path;
            },
            dirname: function (path) {
                var result = PATH.splitPath(path),
                    root = result[0],
                    dir = result[1];
                if (!root && !dir) {
                    return ".";
                }
                if (dir) {
                    dir = dir.substr(0, dir.length - 1);
                }
                return root + dir;
            },
            basename: function (path) {
                if (path === "/") return "/";
                var lastSlash = path.lastIndexOf("/");
                if (lastSlash === -1) return path;
                return path.substr(lastSlash + 1);
            },
            extname: function (path) {
                return PATH.splitPath(path)[3];
            },
            join: function () {
                var paths = Array.prototype.slice.call(arguments, 0);
                return PATH.normalize(paths.join("/"));
            },
            join2: function (l, r) {
                return PATH.normalize(l + "/" + r);
            },
        };
        var SYSCALLS = {
            mappings: {},
            buffers: [null, [], []],
            printChar: function (stream, curr) {
                var buffer = SYSCALLS.buffers[stream];
                if (curr === 0 || curr === 10) {
                    (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
                    buffer.length = 0;
                } else {
                    buffer.push(curr);
                }
            },
            varargs: undefined,
            get: function () {
                SYSCALLS.varargs += 4;
                var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
                return ret;
            },
            getStr: function (ptr) {
                var ret = UTF8ToString(ptr);
                return ret;
            },
            get64: function (low, high) {
                return low;
            },
        };
        function _fd_close(fd) {
            return 0;
        }
        function _fd_read(fd, iov, iovcnt, pnum) {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = SYSCALLS.doReadv(stream, iov, iovcnt);
            HEAP32[pnum >> 2] = num;
            return 0;
        }
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {}
        function _fd_write(fd, iov, iovcnt, pnum) {
            var num = 0;
            for (var i = 0; i < iovcnt; i++) {
                var ptr = HEAP32[(iov + i * 8) >> 2];
                var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
                for (var j = 0; j < len; j++) {
                    SYSCALLS.printChar(fd, HEAPU8[ptr + j]);
                }
                num += len;
            }
            HEAP32[pnum >> 2] = num;
            return 0;
        }
        function _getTempRet0() {
            return getTempRet0() | 0;
        }
        function _gettimeofday(ptr) {
            var now = Date.now();
            HEAP32[ptr >> 2] = (now / 1e3) | 0;
            HEAP32[(ptr + 4) >> 2] = ((now % 1e3) * 1e3) | 0;
            return 0;
        }
        function __webgl_enable_ANGLE_instanced_arrays(ctx) {
            var ext = ctx.getExtension("ANGLE_instanced_arrays");
            if (ext) {
                ctx["vertexAttribDivisor"] = function (index, divisor) {
                    ext["vertexAttribDivisorANGLE"](index, divisor);
                };
                ctx["drawArraysInstanced"] = function (mode, first, count, primcount) {
                    ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
                };
                ctx["drawElementsInstanced"] = function (mode, count, type, indices, primcount) {
                    ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
                };
                return 1;
            }
        }
        function __webgl_enable_OES_vertex_array_object(ctx) {
            var ext = ctx.getExtension("OES_vertex_array_object");
            if (ext) {
                ctx["createVertexArray"] = function () {
                    return ext["createVertexArrayOES"]();
                };
                ctx["deleteVertexArray"] = function (vao) {
                    ext["deleteVertexArrayOES"](vao);
                };
                ctx["bindVertexArray"] = function (vao) {
                    ext["bindVertexArrayOES"](vao);
                };
                ctx["isVertexArray"] = function (vao) {
                    return ext["isVertexArrayOES"](vao);
                };
                return 1;
            }
        }
        function __webgl_enable_WEBGL_draw_buffers(ctx) {
            var ext = ctx.getExtension("WEBGL_draw_buffers");
            if (ext) {
                ctx["drawBuffers"] = function (n, bufs) {
                    ext["drawBuffersWEBGL"](n, bufs);
                };
                return 1;
            }
        }
        function __webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(ctx) {
            return !!(ctx.dibvbi = ctx.getExtension("WEBGL_draw_instanced_base_vertex_base_instance"));
        }
        var GL = {
            counter: 1,
            buffers: [],
            programs: [],
            framebuffers: [],
            renderbuffers: [],
            textures: [],
            uniforms: [],
            shaders: [],
            vaos: [],
            contexts: [],
            offscreenCanvases: {},
            timerQueriesEXT: [],
            queries: [],
            samplers: [],
            transformFeedbacks: [],
            syncs: [],
            programInfos: {},
            stringCache: {},
            stringiCache: {},
            unpackAlignment: 4,
            recordError: function recordError(errorCode) {
                if (!GL.lastError) {
                    GL.lastError = errorCode;
                }
            },
            getNewId: function (table) {
                var ret = GL.counter++;
                for (var i = table.length; i < ret; i++) {
                    table[i] = null;
                }
                return ret;
            },
            getSource: function (shader, count, string, length) {
                var source = "";
                for (var i = 0; i < count; ++i) {
                    var len = length ? HEAP32[(length + i * 4) >> 2] : -1;
                    source += UTF8ToString(HEAP32[(string + i * 4) >> 2], len < 0 ? undefined : len);
                }
                return source;
            },
            createContext: function (canvas, webGLContextAttributes) {
                var ctx = webGLContextAttributes.majorVersion > 1 ? canvas.getContext("webgl2", webGLContextAttributes) : canvas.getContext("webgl", webGLContextAttributes);
                if (!ctx) return 0;
                var handle = GL.registerContext(ctx, webGLContextAttributes);
                return handle;
            },
            registerContext: function (ctx, webGLContextAttributes) {
                var handle = GL.getNewId(GL.contexts);
                var context = { handle: handle, attributes: webGLContextAttributes, version: webGLContextAttributes.majorVersion, GLctx: ctx };
                if (ctx.canvas) ctx.canvas.GLctxObject = context;
                GL.contexts[handle] = context;
                if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
                    GL.initExtensions(context);
                }
                return handle;
            },
            makeContextCurrent: function (contextHandle) {
                GL.currentContext = GL.contexts[contextHandle];
                Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
                return !(contextHandle && !GLctx);
            },
            getContext: function (contextHandle) {
                return GL.contexts[contextHandle];
            },
            deleteContext: function (contextHandle) {
                if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
                if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
                if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
                GL.contexts[contextHandle] = null;
            },
            initExtensions: function (context) {
                if (!context) context = GL.currentContext;
                if (context.initExtensionsDone) return;
                context.initExtensionsDone = true;
                var GLctx = context.GLctx;
                __webgl_enable_ANGLE_instanced_arrays(GLctx);
                __webgl_enable_OES_vertex_array_object(GLctx);
                __webgl_enable_WEBGL_draw_buffers(GLctx);
                __webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
                GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
                var automaticallyEnabledExtensions = [
                    "OES_texture_float",
                    "OES_texture_half_float",
                    "OES_standard_derivatives",
                    "OES_vertex_array_object",
                    "WEBGL_compressed_texture_s3tc",
                    "WEBGL_depth_texture",
                    "OES_element_index_uint",
                    "EXT_texture_filter_anisotropic",
                    "EXT_frag_depth",
                    "WEBGL_draw_buffers",
                    "ANGLE_instanced_arrays",
                    "OES_texture_float_linear",
                    "OES_texture_half_float_linear",
                    "EXT_blend_minmax",
                    "EXT_shader_texture_lod",
                    "EXT_texture_norm16",
                    "WEBGL_compressed_texture_pvrtc",
                    "EXT_color_buffer_half_float",
                    "WEBGL_color_buffer_float",
                    "EXT_sRGB",
                    "WEBGL_compressed_texture_etc1",
                    "EXT_disjoint_timer_query",
                    "WEBGL_compressed_texture_etc",
                    "WEBGL_compressed_texture_astc",
                    "EXT_color_buffer_float",
                    "WEBGL_compressed_texture_s3tc_srgb",
                    "EXT_disjoint_timer_query_webgl2",
                    "WEBKIT_WEBGL_compressed_texture_pvrtc",
                ];
                var exts = GLctx.getSupportedExtensions() || [];
                exts.forEach(function (ext) {
                    if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
                        GLctx.getExtension(ext);
                    }
                });
            },
            populateUniformTable: function (program) {
                var p = GL.programs[program];
                var ptable = (GL.programInfos[program] = { uniforms: {}, maxUniformLength: 0, maxAttributeLength: -1, maxUniformBlockNameLength: -1 });
                var utable = ptable.uniforms;
                var numUniforms = GLctx.getProgramParameter(p, 35718);
                for (var i = 0; i < numUniforms; ++i) {
                    var u = GLctx.getActiveUniform(p, i);
                    var name = u.name;
                    ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
                    if (name.slice(-1) == "]") {
                        name = name.slice(0, name.lastIndexOf("["));
                    }
                    var loc = GLctx.getUniformLocation(p, name);
                    if (loc) {
                        var id = GL.getNewId(GL.uniforms);
                        utable[name] = [u.size, id];
                        GL.uniforms[id] = loc;
                        for (var j = 1; j < u.size; ++j) {
                            var n = name + "[" + j + "]";
                            loc = GLctx.getUniformLocation(p, n);
                            id = GL.getNewId(GL.uniforms);
                            GL.uniforms[id] = loc;
                        }
                    }
                }
            },
        };
        function _glActiveTexture(x0) {
            GLctx["activeTexture"](x0);
        }
        function _glAttachShader(program, shader) {
            GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
        }
        function _glBindAttribLocation(program, index, name) {
            GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
        }
        function _glBindBuffer(target, buffer) {
            if (target == 35051) {
                GLctx.currentPixelPackBufferBinding = buffer;
            } else if (target == 35052) {
                GLctx.currentPixelUnpackBufferBinding = buffer;
            }
            GLctx.bindBuffer(target, GL.buffers[buffer]);
        }
        function _glBindTexture(target, texture) {
            GLctx.bindTexture(target, GL.textures[texture]);
        }
        function _glBlendColor(x0, x1, x2, x3) {
            GLctx["blendColor"](x0, x1, x2, x3);
        }
        function _glBlendFunc(x0, x1) {
            GLctx["blendFunc"](x0, x1);
        }
        function _glBlendFuncSeparate(x0, x1, x2, x3) {
            GLctx["blendFuncSeparate"](x0, x1, x2, x3);
        }
        function _glBufferData(target, size, data, usage) {
            if (GL.currentContext.version >= 2) {
                if (data) {
                    GLctx.bufferData(target, HEAPU8, usage, data, size);
                } else {
                    GLctx.bufferData(target, size, usage);
                }
            } else {
                GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage);
            }
        }
        function _glClear(x0) {
            GLctx["clear"](x0);
        }
        function _glClearColor(x0, x1, x2, x3) {
            GLctx["clearColor"](x0, x1, x2, x3);
        }
        function _glColorMask(red, green, blue, alpha) {
            GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
        }
        function _glCompileShader(shader) {
            GLctx.compileShader(GL.shaders[shader]);
        }
        function _glCreateProgram() {
            var id = GL.getNewId(GL.programs);
            var program = GLctx.createProgram();
            program.name = id;
            GL.programs[id] = program;
            return id;
        }
        function _glCreateShader(shaderType) {
            var id = GL.getNewId(GL.shaders);
            GL.shaders[id] = GLctx.createShader(shaderType);
            return id;
        }
        function _glCullFace(x0) {
            GLctx["cullFace"](x0);
        }
        function _glDeleteBuffers(n, buffers) {
            for (var i = 0; i < n; i++) {
                var id = HEAP32[(buffers + i * 4) >> 2];
                var buffer = GL.buffers[id];
                if (!buffer) continue;
                GLctx.deleteBuffer(buffer);
                buffer.name = 0;
                GL.buffers[id] = null;
                if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
                if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
            }
        }
        function _glDeleteProgram(id) {
            if (!id) return;
            var program = GL.programs[id];
            if (!program) {
                GL.recordError(1281);
                return;
            }
            GLctx.deleteProgram(program);
            program.name = 0;
            GL.programs[id] = null;
            GL.programInfos[id] = null;
        }
        function _glDeleteShader(id) {
            if (!id) return;
            var shader = GL.shaders[id];
            if (!shader) {
                GL.recordError(1281);
                return;
            }
            GLctx.deleteShader(shader);
            GL.shaders[id] = null;
        }
        function _glDeleteTextures(n, textures) {
            for (var i = 0; i < n; i++) {
                var id = HEAP32[(textures + i * 4) >> 2];
                var texture = GL.textures[id];
                if (!texture) continue;
                GLctx.deleteTexture(texture);
                texture.name = 0;
                GL.textures[id] = null;
            }
        }
        function _glDepthFunc(x0) {
            GLctx["depthFunc"](x0);
        }
        function _glDepthMask(flag) {
            GLctx.depthMask(!!flag);
        }
        function _glDisable(x0) {
            GLctx["disable"](x0);
        }
        function _glDisableVertexAttribArray(index) {
            GLctx.disableVertexAttribArray(index);
        }
        function _glDrawArrays(mode, first, count) {
            GLctx.drawArrays(mode, first, count);
        }
        function _glDrawElements(mode, count, type, indices) {
            GLctx.drawElements(mode, count, type, indices);
        }
        function _glEnable(x0) {
            GLctx["enable"](x0);
        }
        function _glEnableVertexAttribArray(index) {
            GLctx.enableVertexAttribArray(index);
        }
        function _glFinish() {
            GLctx["finish"]();
        }
        function _glFrontFace(x0) {
            GLctx["frontFace"](x0);
        }
        function __glGenObject(n, buffers, createFunction, objectTable) {
            for (var i = 0; i < n; i++) {
                var buffer = GLctx[createFunction]();
                var id = buffer && GL.getNewId(objectTable);
                if (buffer) {
                    buffer.name = id;
                    objectTable[id] = buffer;
                } else {
                    GL.recordError(1282);
                }
                HEAP32[(buffers + i * 4) >> 2] = id;
            }
        }
        function _glGenBuffers(n, buffers) {
            __glGenObject(n, buffers, "createBuffer", GL.buffers);
        }
        function _glGenTextures(n, textures) {
            __glGenObject(n, textures, "createTexture", GL.textures);
        }
        function _glGenerateMipmap(x0) {
            GLctx["generateMipmap"](x0);
        }
        function __glGetActiveAttribOrUniform(funcName, program, index, bufSize, length, size, type, name) {
            program = GL.programs[program];
            var info = GLctx[funcName](program, index);
            if (info) {
                var numBytesWrittenExclNull = name && stringToUTF8(info.name, name, bufSize);
                if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
                if (size) HEAP32[size >> 2] = info.size;
                if (type) HEAP32[type >> 2] = info.type;
            }
        }
        function _glGetActiveUniform(program, index, bufSize, length, size, type, name) {
            __glGetActiveAttribOrUniform("getActiveUniform", program, index, bufSize, length, size, type, name);
        }
        function _glGetError() {
            var error = GLctx.getError() || GL.lastError;
            GL.lastError = 0;
            return error;
        }
        function writeI53ToI64(ptr, num) {
            HEAPU32[ptr >> 2] = num;
            HEAPU32[(ptr + 4) >> 2] = (num - HEAPU32[ptr >> 2]) / 4294967296;
        }
        function emscriptenWebGLGet(name_, p, type) {
            if (!p) {
                GL.recordError(1281);
                return;
            }
            var ret = undefined;
            switch (name_) {
                case 36346:
                    ret = 1;
                    break;
                case 36344:
                    if (type != 0 && type != 1) {
                        GL.recordError(1280);
                    }
                    return;
                case 34814:
                case 36345:
                    ret = 0;
                    break;
                case 34466:
                    var formats = GLctx.getParameter(34467);
                    ret = formats ? formats.length : 0;
                    break;
                case 33309:
                    if (GL.currentContext.version < 2) {
                        GL.recordError(1282);
                        return;
                    }
                    var exts = GLctx.getSupportedExtensions() || [];
                    ret = 2 * exts.length;
                    break;
                case 33307:
                case 33308:
                    if (GL.currentContext.version < 2) {
                        GL.recordError(1280);
                        return;
                    }
                    ret = name_ == 33307 ? 3 : 0;
                    break;
            }
            if (ret === undefined) {
                var result = GLctx.getParameter(name_);
                switch (typeof result) {
                    case "number":
                        ret = result;
                        break;
                    case "boolean":
                        ret = result ? 1 : 0;
                        break;
                    case "string":
                        GL.recordError(1280);
                        return;
                    case "object":
                        if (result === null) {
                            switch (name_) {
                                case 34964:
                                case 35725:
                                case 34965:
                                case 36006:
                                case 36007:
                                case 32873:
                                case 34229:
                                case 36662:
                                case 36663:
                                case 35053:
                                case 35055:
                                case 36010:
                                case 35097:
                                case 35869:
                                case 32874:
                                case 36389:
                                case 35983:
                                case 35368:
                                case 34068: {
                                    ret = 0;
                                    break;
                                }
                                default: {
                                    GL.recordError(1280);
                                    return;
                                }
                            }
                        } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
                            for (var i = 0; i < result.length; ++i) {
                                switch (type) {
                                    case 0:
                                        HEAP32[(p + i * 4) >> 2] = result[i];
                                        break;
                                    case 2:
                                        HEAPF32[(p + i * 4) >> 2] = result[i];
                                        break;
                                    case 4:
                                        HEAP8[(p + i) >> 0] = result[i] ? 1 : 0;
                                        break;
                                }
                            }
                            return;
                        } else {
                            try {
                                ret = result.name | 0;
                            } catch (e) {
                                GL.recordError(1280);
                                err("GL_INVALID_ENUM in glGet" + type + "v: Unknown object returned from WebGL getParameter(" + name_ + ")! (error: " + e + ")");
                                return;
                            }
                        }
                        break;
                    default:
                        GL.recordError(1280);
                        err("GL_INVALID_ENUM in glGet" + type + "v: Native code calling glGet" + type + "v(" + name_ + ") and it returns " + result + " of type " + typeof result + "!");
                        return;
                }
            }
            switch (type) {
                case 1:
                    writeI53ToI64(p, ret);
                    break;
                case 0:
                    HEAP32[p >> 2] = ret;
                    break;
                case 2:
                    HEAPF32[p >> 2] = ret;
                    break;
                case 4:
                    HEAP8[p >> 0] = ret ? 1 : 0;
                    break;
            }
        }
        function _glGetIntegerv(name_, p) {
            emscriptenWebGLGet(name_, p, 0);
        }
        function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
            var log = GLctx.getProgramInfoLog(GL.programs[program]);
            if (log === null) log = "(unknown error)";
            var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
            if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
        }
        function _glGetProgramiv(program, pname, p) {
            if (!p) {
                GL.recordError(1281);
                return;
            }
            if (program >= GL.counter) {
                GL.recordError(1281);
                return;
            }
            var ptable = GL.programInfos[program];
            if (!ptable) {
                GL.recordError(1282);
                return;
            }
            if (pname == 35716) {
                var log = GLctx.getProgramInfoLog(GL.programs[program]);
                if (log === null) log = "(unknown error)";
                HEAP32[p >> 2] = log.length + 1;
            } else if (pname == 35719) {
                HEAP32[p >> 2] = ptable.maxUniformLength;
            } else if (pname == 35722) {
                if (ptable.maxAttributeLength == -1) {
                    program = GL.programs[program];
                    var numAttribs = GLctx.getProgramParameter(program, 35721);
                    ptable.maxAttributeLength = 0;
                    for (var i = 0; i < numAttribs; ++i) {
                        var activeAttrib = GLctx.getActiveAttrib(program, i);
                        ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1);
                    }
                }
                HEAP32[p >> 2] = ptable.maxAttributeLength;
            } else if (pname == 35381) {
                if (ptable.maxUniformBlockNameLength == -1) {
                    program = GL.programs[program];
                    var numBlocks = GLctx.getProgramParameter(program, 35382);
                    ptable.maxUniformBlockNameLength = 0;
                    for (var i = 0; i < numBlocks; ++i) {
                        var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
                        ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1);
                    }
                }
                HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
            } else {
                HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
            }
        }
        function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
            var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
            if (log === null) log = "(unknown error)";
            var numBytesWrittenExclNull = maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0;
            if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
        }
        function _glGetShaderiv(shader, pname, p) {
            if (!p) {
                GL.recordError(1281);
                return;
            }
            if (pname == 35716) {
                var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
                if (log === null) log = "(unknown error)";
                HEAP32[p >> 2] = log.length + 1;
            } else if (pname == 35720) {
                var source = GLctx.getShaderSource(GL.shaders[shader]);
                var sourceLength = source === null || source.length == 0 ? 0 : source.length + 1;
                HEAP32[p >> 2] = sourceLength;
            } else {
                HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
            }
        }
        function jstoi_q(str) {
            return parseInt(str);
        }
        function _glGetUniformLocation(program, name) {
            name = UTF8ToString(name);
            var arrayIndex = 0;
            if (name[name.length - 1] == "]") {
                var leftBrace = name.lastIndexOf("[");
                arrayIndex = name[leftBrace + 1] != "]" ? jstoi_q(name.slice(leftBrace + 1)) : 0;
                name = name.slice(0, leftBrace);
            }
            var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
            if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
                return uniformInfo[1] + arrayIndex;
            } else {
                return -1;
            }
        }
        function _glLineWidth(x0) {
            GLctx["lineWidth"](x0);
        }
        function _glLinkProgram(program) {
            GLctx.linkProgram(GL.programs[program]);
            GL.populateUniformTable(program);
        }
        function _glPixelStorei(pname, param) {
            if (pname == 3317) {
                GL.unpackAlignment = param;
            }
            GLctx.pixelStorei(pname, param);
        }
        function _glShaderSource(shader, count, string, length) {
            var source = GL.getSource(shader, count, string, length);
            GLctx.shaderSource(GL.shaders[shader], source);
        }
        function _glStencilFunc(x0, x1, x2) {
            GLctx["stencilFunc"](x0, x1, x2);
        }
        function _glStencilMask(x0) {
            GLctx["stencilMask"](x0);
        }
        function _glStencilOp(x0, x1, x2) {
            GLctx["stencilOp"](x0, x1, x2);
        }
        function _glStencilOpSeparate(x0, x1, x2, x3) {
            GLctx["stencilOpSeparate"](x0, x1, x2, x3);
        }
        function __computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
            function roundedToNextMultipleOf(x, y) {
                return (x + y - 1) & -y;
            }
            var plainRowSize = width * sizePerPixel;
            var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
            return height * alignedRowSize;
        }
        function __colorChannelsInGlTextureFormat(format) {
            var colorChannels = { 5: 3, 6: 4, 8: 2, 29502: 3, 29504: 4, 26917: 2, 26918: 2, 29846: 3, 29847: 4 };
            return colorChannels[format - 6402] || 1;
        }
        function __heapObjectForWebGLType(type) {
            type -= 5120;
            if (type == 0) return HEAP8;
            if (type == 1) return HEAPU8;
            if (type == 2) return HEAP16;
            if (type == 4) return HEAP32;
            if (type == 6) return HEAPF32;
            if (type == 5 || type == 28922 || type == 28520 || type == 30779 || type == 30782) return HEAPU32;
            return HEAPU16;
        }
        function __heapAccessShiftForWebGLHeap(heap) {
            return 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
        }
        function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
            var heap = __heapObjectForWebGLType(type);
            var shift = __heapAccessShiftForWebGLHeap(heap);
            var byteSize = 1 << shift;
            var sizePerPixel = __colorChannelsInGlTextureFormat(format) * byteSize;
            var bytes = __computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
            return heap.subarray(pixels >> shift, (pixels + bytes) >> shift);
        }
        function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
            if (GL.currentContext.version >= 2) {
                if (GLctx.currentPixelUnpackBufferBinding) {
                    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
                } else if (pixels) {
                    var heap = __heapObjectForWebGLType(type);
                    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, heap, pixels >> __heapAccessShiftForWebGLHeap(heap));
                } else {
                    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, null);
                }
                return;
            }
            GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
        }
        function _glTexParameterf(x0, x1, x2) {
            GLctx["texParameterf"](x0, x1, x2);
        }
        function _glTexParameteri(x0, x1, x2) {
            GLctx["texParameteri"](x0, x1, x2);
        }
        function _glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
            if (GL.currentContext.version >= 2) {
                if (GLctx.currentPixelUnpackBufferBinding) {
                    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels);
                } else if (pixels) {
                    var heap = __heapObjectForWebGLType(type);
                    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, heap, pixels >> __heapAccessShiftForWebGLHeap(heap));
                } else {
                    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, null);
                }
                return;
            }
            var pixelData = null;
            if (pixels) pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
            GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
        }
        function _glUniform1f(location, v0) {
            GLctx.uniform1f(GL.uniforms[location], v0);
        }
        var __miniTempWebGLFloatBuffers = [];
        function _glUniform1fv(location, count, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniform1fv(GL.uniforms[location], HEAPF32, value >> 2, count);
                return;
            }
            if (count <= 288) {
                var view = __miniTempWebGLFloatBuffers[count - 1];
                for (var i = 0; i < count; ++i) {
                    view[i] = HEAPF32[(value + 4 * i) >> 2];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 4) >> 2);
            }
            GLctx.uniform1fv(GL.uniforms[location], view);
        }
        function _glUniform1i(location, v0) {
            GLctx.uniform1i(GL.uniforms[location], v0);
        }
        function _glUniform2fv(location, count, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniform2fv(GL.uniforms[location], HEAPF32, value >> 2, count * 2);
                return;
            }
            if (count <= 144) {
                var view = __miniTempWebGLFloatBuffers[2 * count - 1];
                for (var i = 0; i < 2 * count; i += 2) {
                    view[i] = HEAPF32[(value + 4 * i) >> 2];
                    view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 8) >> 2);
            }
            GLctx.uniform2fv(GL.uniforms[location], view);
        }
        function _glUniform3fv(location, count, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniform3fv(GL.uniforms[location], HEAPF32, value >> 2, count * 3);
                return;
            }
            if (count <= 96) {
                var view = __miniTempWebGLFloatBuffers[3 * count - 1];
                for (var i = 0; i < 3 * count; i += 3) {
                    view[i] = HEAPF32[(value + 4 * i) >> 2];
                    view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
                    view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 12) >> 2);
            }
            GLctx.uniform3fv(GL.uniforms[location], view);
        }
        function _glUniform4fv(location, count, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniform4fv(GL.uniforms[location], HEAPF32, value >> 2, count * 4);
                return;
            }
            if (count <= 72) {
                var view = __miniTempWebGLFloatBuffers[4 * count - 1];
                var heap = HEAPF32;
                value >>= 2;
                for (var i = 0; i < 4 * count; i += 4) {
                    var dst = value + i;
                    view[i] = heap[dst];
                    view[i + 1] = heap[dst + 1];
                    view[i + 2] = heap[dst + 2];
                    view[i + 3] = heap[dst + 3];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
            }
            GLctx.uniform4fv(GL.uniforms[location], view);
        }
        function _glUniformMatrix3fv(location, count, transpose, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 9);
                return;
            }
            if (count <= 32) {
                var view = __miniTempWebGLFloatBuffers[9 * count - 1];
                for (var i = 0; i < 9 * count; i += 9) {
                    view[i] = HEAPF32[(value + 4 * i) >> 2];
                    view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
                    view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
                    view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
                    view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
                    view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
                    view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
                    view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
                    view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 36) >> 2);
            }
            GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, view);
        }
        function _glUniformMatrix4fv(location, count, transpose, value) {
            if (GL.currentContext.version >= 2) {
                GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, HEAPF32, value >> 2, count * 16);
                return;
            }
            if (count <= 18) {
                var view = __miniTempWebGLFloatBuffers[16 * count - 1];
                var heap = HEAPF32;
                value >>= 2;
                for (var i = 0; i < 16 * count; i += 16) {
                    var dst = value + i;
                    view[i] = heap[dst];
                    view[i + 1] = heap[dst + 1];
                    view[i + 2] = heap[dst + 2];
                    view[i + 3] = heap[dst + 3];
                    view[i + 4] = heap[dst + 4];
                    view[i + 5] = heap[dst + 5];
                    view[i + 6] = heap[dst + 6];
                    view[i + 7] = heap[dst + 7];
                    view[i + 8] = heap[dst + 8];
                    view[i + 9] = heap[dst + 9];
                    view[i + 10] = heap[dst + 10];
                    view[i + 11] = heap[dst + 11];
                    view[i + 12] = heap[dst + 12];
                    view[i + 13] = heap[dst + 13];
                    view[i + 14] = heap[dst + 14];
                    view[i + 15] = heap[dst + 15];
                }
            } else {
                var view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2);
            }
            GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
        }
        function _glUseProgram(program) {
            GLctx.useProgram(GL.programs[program]);
        }
        function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
            GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
        }
        function _glViewport(x0, x1, x2, x3) {
            GLctx["viewport"](x0, x1, x2, x3);
        }
        function _round(d) {
            d = +d;
            return d >= +0 ? +Math_floor(d + +0.5) : +Math_ceil(d - +0.5);
        }
        function _roundf(d) {
            d = +d;
            return d >= +0 ? +Math_floor(d + +0.5) : +Math_ceil(d - +0.5);
        }
        function _setTempRet0($i) {
            setTempRet0($i | 0);
        }
        Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas) {
            Browser.requestFullscreen(lockPointer, resizeCanvas);
        };
        Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
            Browser.requestAnimationFrame(func);
        };
        Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
            Browser.setCanvasSize(width, height, noUpdates);
        };
        Module["pauseMainLoop"] = function Module_pauseMainLoop() {
            Browser.mainLoop.pause();
        };
        Module["resumeMainLoop"] = function Module_resumeMainLoop() {
            Browser.mainLoop.resume();
        };
        Module["getUserMedia"] = function Module_getUserMedia() {
            Browser.getUserMedia();
        };
        Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
            return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
        };
        var GLctx;
        var __miniTempWebGLFloatBuffersStorage = new Float32Array(288);
        for (var i = 0; i < 288; ++i) {
            __miniTempWebGLFloatBuffers[i] = __miniTempWebGLFloatBuffersStorage.subarray(0, i + 1);
        }
        function intArrayFromString(stringy, dontAddNull, length) {
            var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
            var u8array = new Array(len);
            var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
            if (dontAddNull) u8array.length = numBytesWritten;
            return u8array;
        }
        var asmLibraryArg = {
            pa: _emscripten_async_wget2_abort,
            oa: _emscripten_async_wget2_data,
            e: _emscripten_longjmp,
            fa: _emscripten_memcpy_big,
            ga: _emscripten_resize_heap,
            a: _exit,
            ia: _fd_close,
            ha: _fd_read,
            ea: _fd_seek,
            T: _fd_write,
            h: _getTempRet0,
            Q: _gettimeofday,
            o: _glActiveTexture,
            B: _glAttachShader,
            H: _glBindAttribLocation,
            t: _glBindBuffer,
            d: _glBindTexture,
            Z: _glBlendColor,
            E: _glBlendFunc,
            l: _glBlendFuncSeparate,
            x: _glBufferData,
            _: _glClear,
            za: _glClearColor,
            m: _glColorMask,
            J: _glCompileShader,
            Y: _glCreateProgram,
            D: _glCreateShader,
            n: _glCullFace,
            w: _glDeleteBuffers,
            Aa: _glDeleteProgram,
            $: _glDeleteShader,
            R: _glDeleteTextures,
            xa: _glDepthFunc,
            s: _glDepthMask,
            c: _glDisable,
            M: _glDisableVertexAttribArray,
            i: _glDrawArrays,
            ta: _glDrawElements,
            b: _glEnable,
            P: _glEnableVertexAttribArray,
            ua: _glFinish,
            Ba: _glFrontFace,
            v: _glGenBuffers,
            z: _glGenTextures,
            da: _glGenerateMipmap,
            na: _glGetActiveUniform,
            g: _glGetError,
            va: _glGetIntegerv,
            W: _glGetProgramInfoLog,
            A: _glGetProgramiv,
            I: _glGetShaderInfoLog,
            C: _glGetShaderiv,
            F: _glGetUniformLocation,
            wa: _glLineWidth,
            X: _glLinkProgram,
            y: _glPixelStorei,
            K: _glShaderSource,
            p: _glStencilFunc,
            G: _glStencilMask,
            q: _glStencilOp,
            aa: _glStencilOpSeparate,
            S: _glTexImage2D,
            V: _glTexParameterf,
            u: _glTexParameteri,
            Ca: _glTexSubImage2D,
            la: _glUniform1f,
            ka: _glUniform1fv,
            ca: _glUniform1i,
            ba: _glUniform2fv,
            ma: _glUniform3fv,
            N: _glUniform4fv,
            ja: _glUniformMatrix3fv,
            U: _glUniformMatrix4fv,
            j: _glUseProgram,
            O: _glVertexAttribPointer,
            ya: _glViewport,
            sa: invoke_ii,
            ra: invoke_iii,
            r: invoke_vii,
            qa: invoke_viiiii,
            memory: wasmMemory,
            k: _round,
            L: _roundf,
            f: _setTempRet0,
            table: wasmTable,
        };
        var asm = createWasm();
        var ___wasm_call_ctors = (Module["___wasm_call_ctors"] = function () {
            return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["Da"]).apply(null, arguments);
        });
        var _module_update = (Module["_module_update"] = function () {
            return (_module_update = Module["_module_update"] = Module["asm"]["Ea"]).apply(null, arguments);
        });
        var _module_list_objs2 = (Module["_module_list_objs2"] = function () {
            return (_module_list_objs2 = Module["_module_list_objs2"] = Module["asm"]["Fa"]).apply(null, arguments);
        });
        var _module_add_data_source = (Module["_module_add_data_source"] = function () {
            return (_module_add_data_source = Module["_module_add_data_source"] = Module["asm"]["Ga"]).apply(null, arguments);
        });
        var _free = (Module["_free"] = function () {
            return (_free = Module["_free"] = Module["asm"]["Ha"]).apply(null, arguments);
        });
        var _module_add_global_listener = (Module["_module_add_global_listener"] = function () {
            return (_module_add_global_listener = Module["_module_add_global_listener"] = Module["asm"]["Ia"]).apply(null, arguments);
        });
        var _module_add = (Module["_module_add"] = function () {
            return (_module_add = Module["_module_add"] = Module["asm"]["Ja"]).apply(null, arguments);
        });
        var _obj_retain = (Module["_obj_retain"] = function () {
            return (_obj_retain = Module["_obj_retain"] = Module["asm"]["Ka"]).apply(null, arguments);
        });
        var _module_add_new = (Module["_module_add_new"] = function () {
            return (_module_add_new = Module["_module_add_new"] = Module["asm"]["La"]).apply(null, arguments);
        });
        var _obj_release = (Module["_obj_release"] = function () {
            return (_obj_release = Module["_obj_release"] = Module["asm"]["Ma"]).apply(null, arguments);
        });
        var _module_remove = (Module["_module_remove"] = function () {
            return (_module_remove = Module["_module_remove"] = Module["asm"]["Na"]).apply(null, arguments);
        });
        var _module_get_child = (Module["_module_get_child"] = function () {
            return (_module_get_child = Module["_module_get_child"] = Module["asm"]["Oa"]).apply(null, arguments);
        });
        var _module_get_tree = (Module["_module_get_tree"] = function () {
            return (_module_get_tree = Module["_module_get_tree"] = Module["asm"]["Pa"]).apply(null, arguments);
        });
        var _module_get_path = (Module["_module_get_path"] = function () {
            return (_module_get_path = Module["_module_get_path"] = Module["asm"]["Qa"]).apply(null, arguments);
        });
        var _observer_update = (Module["_observer_update"] = function () {
            return (_observer_update = Module["_observer_update"] = Module["asm"]["Ra"]).apply(null, arguments);
        });
        var _malloc = (Module["_malloc"] = function () {
            return (_malloc = Module["_malloc"] = Module["asm"]["Sa"]).apply(null, arguments);
        });
        var _convert_frame = (Module["_convert_frame"] = function () {
            return (_convert_frame = Module["_convert_frame"] = Module["asm"]["Ta"]).apply(null, arguments);
        });
        var _convert_framev4 = (Module["_convert_framev4"] = function () {
            return (_convert_framev4 = Module["_convert_framev4"] = Module["asm"]["Ua"]).apply(null, arguments);
        });
        var _sys_set_translate_function = (Module["_sys_set_translate_function"] = function () {
            return (_sys_set_translate_function = Module["_sys_set_translate_function"] = Module["asm"]["Va"]).apply(null, arguments);
        });
        var _core_add_font = (Module["_core_add_font"] = function () {
            return (_core_add_font = Module["_core_add_font"] = Module["asm"]["Wa"]).apply(null, arguments);
        });
        var _obj_create_str = (Module["_obj_create_str"] = function () {
            return (_obj_create_str = Module["_obj_create_str"] = Module["asm"]["Xa"]).apply(null, arguments);
        });
        var _obj_clone = (Module["_obj_clone"] = function () {
            return (_obj_clone = Module["_obj_clone"] = Module["asm"]["Ya"]).apply(null, arguments);
        });
        var _obj_get_designations = (Module["_obj_get_designations"] = function () {
            return (_obj_get_designations = Module["_obj_get_designations"] = Module["asm"]["Za"]).apply(null, arguments);
        });
        var _obj_get_info_json = (Module["_obj_get_info_json"] = function () {
            return (_obj_get_info_json = Module["_obj_get_info_json"] = Module["asm"]["_a"]).apply(null, arguments);
        });
        var _obj_get_id = (Module["_obj_get_id"] = function () {
            return (_obj_get_id = Module["_obj_get_id"] = Module["asm"]["$a"]).apply(null, arguments);
        });
        var _obj_get_json_data_str = (Module["_obj_get_json_data_str"] = function () {
            return (_obj_get_json_data_str = Module["_obj_get_json_data_str"] = Module["asm"]["ab"]).apply(null, arguments);
        });
        var _obj_get_attr_ = (Module["_obj_get_attr_"] = function () {
            return (_obj_get_attr_ = Module["_obj_get_attr_"] = Module["asm"]["bb"]).apply(null, arguments);
        });
        var _obj_foreach_attr = (Module["_obj_foreach_attr"] = function () {
            return (_obj_foreach_attr = Module["_obj_foreach_attr"] = Module["asm"]["cb"]).apply(null, arguments);
        });
        var _obj_foreach_child = (Module["_obj_foreach_child"] = function () {
            return (_obj_foreach_child = Module["_obj_foreach_child"] = Module["asm"]["db"]).apply(null, arguments);
        });
        var _obj_call_json_str = (Module["_obj_call_json_str"] = function () {
            return (_obj_call_json_str = Module["_obj_call_json_str"] = Module["asm"]["eb"]).apply(null, arguments);
        });
        var _get_compiler_str = (Module["_get_compiler_str"] = function () {
            return (_get_compiler_str = Module["_get_compiler_str"] = Module["asm"]["fb"]).apply(null, arguments);
        });
        var _a2tf_json = (Module["_a2tf_json"] = function () {
            return (_a2tf_json = Module["_a2tf_json"] = Module["asm"]["gb"]).apply(null, arguments);
        });
        var _a2af_json = (Module["_a2af_json"] = function () {
            return (_a2af_json = Module["_a2af_json"] = Module["asm"]["hb"]).apply(null, arguments);
        });
        var _compute_event = (Module["_compute_event"] = function () {
            return (_compute_event = Module["_compute_event"] = Module["asm"]["ib"]).apply(null, arguments);
        });
        var _core_get_module = (Module["_core_get_module"] = function () {
            return (_core_get_module = Module["_core_get_module"] = Module["asm"]["jb"]).apply(null, arguments);
        });
        var _core_init = (Module["_core_init"] = function () {
            return (_core_init = Module["_core_init"] = Module["asm"]["kb"]).apply(null, arguments);
        });
        var _core_update = (Module["_core_update"] = function () {
            return (_core_update = Module["_core_update"] = Module["asm"]["lb"]).apply(null, arguments);
        });
        var _core_render = (Module["_core_render"] = function () {
            return (_core_render = Module["_core_render"] = Module["asm"]["mb"]).apply(null, arguments);
        });
        var _core_on_mouse = (Module["_core_on_mouse"] = function () {
            return (_core_on_mouse = Module["_core_on_mouse"] = Module["asm"]["nb"]).apply(null, arguments);
        });
        var _core_on_pinch = (Module["_core_on_pinch"] = function () {
            return (_core_on_pinch = Module["_core_on_pinch"] = Module["asm"]["ob"]).apply(null, arguments);
        });
        var _core_on_key = (Module["_core_on_key"] = function () {
            return (_core_on_key = Module["_core_on_key"] = Module["asm"]["pb"]).apply(null, arguments);
        });
        var _core_on_zoom = (Module["_core_on_zoom"] = function () {
            return (_core_on_zoom = Module["_core_on_zoom"] = Module["asm"]["qb"]).apply(null, arguments);
        });
        var _core_lookat = (Module["_core_lookat"] = function () {
            return (_core_lookat = Module["_core_lookat"] = Module["asm"]["rb"]).apply(null, arguments);
        });
        var _core_point_and_lock = (Module["_core_point_and_lock"] = function () {
            return (_core_point_and_lock = Module["_core_point_and_lock"] = Module["asm"]["sb"]).apply(null, arguments);
        });
        var _core_zoomto = (Module["_core_zoomto"] = function () {
            return (_core_zoomto = Module["_core_zoomto"] = Module["asm"]["tb"]).apply(null, arguments);
        });
        var _core_set_time = (Module["_core_set_time"] = function () {
            return (_core_set_time = Module["_core_set_time"] = Module["asm"]["ub"]).apply(null, arguments);
        });
        var _otype_to_str = (Module["_otype_to_str"] = function () {
            return (_otype_to_str = Module["_otype_to_str"] = Module["asm"]["vb"]).apply(null, arguments);
        });
        var _core_search = (Module["_core_search"] = function () {
            return (_core_search = Module["_core_search"] = Module["asm"]["wb"]).apply(null, arguments);
        });
        var _designation_cleanup = (Module["_designation_cleanup"] = function () {
            return (_designation_cleanup = Module["_designation_cleanup"] = Module["asm"]["xb"]).apply(null, arguments);
        });
        var _skycultures_get_designations = (Module["_skycultures_get_designations"] = function () {
            return (_skycultures_get_designations = Module["_skycultures_get_designations"] = Module["asm"]["yb"]).apply(null, arguments);
        });
        var _skycultures_get_cultural_names_json = (Module["_skycultures_get_cultural_names_json"] = function () {
            return (_skycultures_get_cultural_names_json = Module["_skycultures_get_cultural_names_json"] = Module["asm"]["zb"]).apply(null, arguments);
        });
        var _geojson_set_bool_ptr_ = (Module["_geojson_set_bool_ptr_"] = function () {
            return (_geojson_set_bool_ptr_ = Module["_geojson_set_bool_ptr_"] = Module["asm"]["Ab"]).apply(null, arguments);
        });
        var _geojson_set_color_ptr_ = (Module["_geojson_set_color_ptr_"] = function () {
            return (_geojson_set_color_ptr_ = Module["_geojson_set_color_ptr_"] = Module["asm"]["Bb"]).apply(null, arguments);
        });
        var _geojson_remove_all_features = (Module["_geojson_remove_all_features"] = function () {
            return (_geojson_remove_all_features = Module["_geojson_remove_all_features"] = Module["asm"]["Cb"]).apply(null, arguments);
        });
        var _geojson_filter_all = (Module["_geojson_filter_all"] = function () {
            return (_geojson_filter_all = Module["_geojson_filter_all"] = Module["asm"]["Db"]).apply(null, arguments);
        });
        var _geojson_add_poly_feature = (Module["_geojson_add_poly_feature"] = function () {
            return (_geojson_add_poly_feature = Module["_geojson_add_poly_feature"] = Module["asm"]["Eb"]).apply(null, arguments);
        });
        var _geojson_query_rendered_features = (Module["_geojson_query_rendered_features"] = function () {
            return (_geojson_query_rendered_features = Module["_geojson_query_rendered_features"] = Module["asm"]["Fb"]).apply(null, arguments);
        });
        var _geojson_set_on_new_tile_callback = (Module["_geojson_set_on_new_tile_callback"] = function () {
            return (_geojson_set_on_new_tile_callback = Module["_geojson_set_on_new_tile_callback"] = Module["asm"]["Gb"]).apply(null, arguments);
        });
        var _geojson_survey_query_rendered_features = (Module["_geojson_survey_query_rendered_features"] = function () {
            return (_geojson_survey_query_rendered_features = Module["_geojson_survey_query_rendered_features"] = Module["asm"]["Hb"]).apply(null, arguments);
        });
        var _calendar_create = (Module["_calendar_create"] = function () {
            return (_calendar_create = Module["_calendar_create"] = Module["asm"]["Ib"]).apply(null, arguments);
        });
        var _calendar_compute = (Module["_calendar_compute"] = function () {
            return (_calendar_compute = Module["_calendar_compute"] = Module["asm"]["Jb"]).apply(null, arguments);
        });
        var _calendar_delete = (Module["_calendar_delete"] = function () {
            return (_calendar_delete = Module["_calendar_delete"] = Module["asm"]["Kb"]).apply(null, arguments);
        });
        var _calendar_get_results_callback = (Module["_calendar_get_results_callback"] = function () {
            return (_calendar_get_results_callback = Module["_calendar_get_results_callback"] = Module["asm"]["Lb"]).apply(null, arguments);
        });
        var _calendar_get = (Module["_calendar_get"] = function () {
            return (_calendar_get = Module["_calendar_get"] = Module["asm"]["Mb"]).apply(null, arguments);
        });
        var _setThrew = (Module["_setThrew"] = function () {
            return (_setThrew = Module["_setThrew"] = Module["asm"]["Nb"]).apply(null, arguments);
        });
        var stackSave = (Module["stackSave"] = function () {
            return (stackSave = Module["stackSave"] = Module["asm"]["Ob"]).apply(null, arguments);
        });
        var stackRestore = (Module["stackRestore"] = function () {
            return (stackRestore = Module["stackRestore"] = Module["asm"]["Pb"]).apply(null, arguments);
        });
        var stackAlloc = (Module["stackAlloc"] = function () {
            return (stackAlloc = Module["stackAlloc"] = Module["asm"]["Qb"]).apply(null, arguments);
        });
        var dynCall_vi = (Module["dynCall_vi"] = function () {
            return (dynCall_vi = Module["dynCall_vi"] = Module["asm"]["Rb"]).apply(null, arguments);
        });
        var dynCall_vii = (Module["dynCall_vii"] = function () {
            return (dynCall_vii = Module["dynCall_vii"] = Module["asm"]["Sb"]).apply(null, arguments);
        });
        var dynCall_viiiii = (Module["dynCall_viiiii"] = function () {
            return (dynCall_viiiii = Module["dynCall_viiiii"] = Module["asm"]["Tb"]).apply(null, arguments);
        });
        var dynCall_ii = (Module["dynCall_ii"] = function () {
            return (dynCall_ii = Module["dynCall_ii"] = Module["asm"]["Ub"]).apply(null, arguments);
        });
        var dynCall_iii = (Module["dynCall_iii"] = function () {
            return (dynCall_iii = Module["dynCall_iii"] = Module["asm"]["Vb"]).apply(null, arguments);
        });
        var dynCall_viiii = (Module["dynCall_viiii"] = function () {
            return (dynCall_viiii = Module["dynCall_viiii"] = Module["asm"]["Wb"]).apply(null, arguments);
        });
        function invoke_vii(index, a1, a2) {
            var sp = stackSave();
            try {
                dynCall_vii(index, a1, a2);
            } catch (e) {
                stackRestore(sp);
                if (e !== e + 0 && e !== "longjmp") throw e;
                _setThrew(1, 0);
            }
        }
        function invoke_ii(index, a1) {
            var sp = stackSave();
            try {
                return dynCall_ii(index, a1);
            } catch (e) {
                stackRestore(sp);
                if (e !== e + 0 && e !== "longjmp") throw e;
                _setThrew(1, 0);
            }
        }
        function invoke_iii(index, a1, a2) {
            var sp = stackSave();
            try {
                return dynCall_iii(index, a1, a2);
            } catch (e) {
                stackRestore(sp);
                if (e !== e + 0 && e !== "longjmp") throw e;
                _setThrew(1, 0);
            }
        }
        function invoke_viiiii(index, a1, a2, a3, a4, a5) {
            var sp = stackSave();
            try {
                dynCall_viiiii(index, a1, a2, a3, a4, a5);
            } catch (e) {
                stackRestore(sp);
                if (e !== e + 0 && e !== "longjmp") throw e;
                _setThrew(1, 0);
            }
        }
        Module["intArrayFromString"] = intArrayFromString;
        Module["ccall"] = ccall;
        Module["cwrap"] = cwrap;
        Module["setValue"] = setValue;
        Module["getValue"] = getValue;
        Module["allocate"] = allocate;
        Module["UTF8ToString"] = UTF8ToString;
        Module["stringToUTF8"] = stringToUTF8;
        Module["lengthBytesUTF8"] = lengthBytesUTF8;
        Module["writeArrayToMemory"] = writeArrayToMemory;
        Module["writeAsciiToMemory"] = writeAsciiToMemory;
        Module["addFunction"] = addFunction;
        Module["removeFunction"] = removeFunction;
        Module["GL"] = GL;
        Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
        var calledRun;
        function ExitStatus(status) {
            this.name = "ExitStatus";
            this.message = "Program terminated with exit(" + status + ")";
            this.status = status;
        }
        dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
        };
        function run(args) {
            args = args || arguments_;
            if (runDependencies > 0) {
                return;
            }
            preRun();
            if (runDependencies > 0) return;
            function doRun() {
                if (calledRun) return;
                calledRun = true;
                Module["calledRun"] = true;
                if (ABORT) return;
                initRuntime();
                preMain();
                readyPromiseResolve(Module);
                if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
                postRun();
            }
            if (Module["setStatus"]) {
                Module["setStatus"]("Running...");
                setTimeout(function () {
                    setTimeout(function () {
                        Module["setStatus"]("");
                    }, 1);
                    doRun();
                }, 1);
            } else {
                doRun();
            }
        }
        Module["run"] = run;
        function exit(status, implicit) {
            if (implicit && noExitRuntime && status === 0) {
                return;
            }
            if (noExitRuntime) {
            } else {
                ABORT = true;
                EXITSTATUS = status;
                exitRuntime();
                if (Module["onExit"]) Module["onExit"](status);
            }
            quit_(status, new ExitStatus(status));
        }
        if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
                Module["preInit"].pop()();
            }
        }
        noExitRuntime = true;
        run();

        return StelWebEngine.ready;
    };
})();
