'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _opensubtitlesApi = require('opensubtitles-api');

var _opensubtitlesApi2 = _interopRequireDefault(_opensubtitlesApi);

var _yifysubtitlesApi = require('yifysubtitles-api');

var _yifysubtitlesApi2 = _interopRequireDefault(_yifysubtitlesApi);

var _omdbClient = require('omdb-client');

var _omdbClient2 = _interopRequireDefault(_omdbClient);

var _subtitle = require('subtitle');

var _subtitle2 = _interopRequireDefault(_subtitle);

var _yandex = require('yandex.translate');

var _yandex2 = _interopRequireDefault(_yandex);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _promisePatterns = require('promise-patterns');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _admZip = require('adm-zip');

var _admZip2 = _interopRequireDefault(_admZip);

var _detectCharacterEncoding = require('detect-character-encoding');

var _detectCharacterEncoding2 = _interopRequireDefault(_detectCharacterEncoding);

var _languages = require('./../config/languages.json');

var _languages2 = _interopRequireDefault(_languages);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SubtitlesManager = function (_events$EventEmitter) {
    _inherits(SubtitlesManager, _events$EventEmitter);

    function SubtitlesManager(search, lang) {
        var api = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'yify';

        _classCallCheck(this, SubtitlesManager);

        var _this = _possibleConstructorReturn(this, (SubtitlesManager.__proto__ || Object.getPrototypeOf(SubtitlesManager)).call(this));

        _this.initSearch(search);
        _this.initLang(lang);
        _this.initApi(api);
        _this.subtitles = {};
        return _this;
    }

    _createClass(SubtitlesManager, [{
        key: 'initSearch',
        value: function initSearch(search) {
            var re = new RegExp('^(tt)?(\\d){6,}$', 'i');
            if (re.test(search)) {
                this.imdbId = ('tt' + search).replace('tt'.repeat(2), 'tt');
            } else {
                this.title = search;
            }
        }
    }, {
        key: 'initLang',
        value: function initLang(lang) {
            this.lang = lang;
        }
    }, {
        key: 'initApi',
        value: function initApi(api) {
            if ('os' == api) {
                this.api = new _opensubtitlesApi2.default({
                    useragent: process.env['OS.useragent'],
                    username: process.env['OS.username'],
                    password: process.env['OS.password']
                });
            } else if ('yify' == api) {
                this.api = _yifysubtitlesApi2.default;
            } else {
                throw 'Unsupported api.';
            }
        }
    }, {
        key: 'reset',
        value: function reset() {
            this.imdbId = null;
            this.title = null;
            this.movieLang = null;
            this.subtitles = {};
        }
    }, {
        key: 'search',
        value: function search() {
            var _this2 = this;

            var translate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

            return this.searchMovie().then(function () {
                if (!_this2.movieFound) {
                    throw 'Movie not found.';
                }
                return _this2.searchSubtitles();
            }).then(function () {
                if (_this2.subtitles.hasOwnProperty(_this2.lang)) {
                    return _this2.downloadSubtitles();
                }
                _this2.initApi(_yifysubtitlesApi2.default === _this2.api ? 'os' : 'yify');
                return _this2.searchSubtitles().then(function () {
                    if (_this2.subtitles.hasOwnProperty(_this2.lang)) {
                        return _this2.downloadSubtitles();
                    }
                    if (!translate || _this2.lang === _this2.movieLang || !_this2.subtitles.hasOwnProperty(_this2.movieLang)) {
                        throw 'Subtitles not found.';
                    }
                    var lang = _this2.lang;
                    _this2.lang = _this2.movieLang;
                    return _this2.downloadSubtitles().then(function (data) {
                        return _this2.translate(data, lang).then(function (translatedData) {
                            _this2.lang = lang;
                            return translatedData;
                        });
                    }).catch(function (err) {
                        throw err;
                    });
                });
            }).catch(function (err) {
                return { error: err };
            });
        }
    }, {
        key: 'searchMovie',
        value: function searchMovie() {
            var _this3 = this;

            return new Promise(function (suc, rej) {
                _this3.movieFound = false;
                var params = {};
                if (_this3.imdbId) {
                    params.id = _this3.imdbId;
                } else {
                    params.title = _this3.title;
                }
                _omdbClient2.default.get(params, function (err, data) {
                    if (err) {
                        _this3.movieFound = false;
                        rej(err);
                    } else {
                        _this3.imdbId = data.imdbID;
                        _this3.title = data.Title;
                        _this3.movieFound = true;
                        _this3.movieLang = _languages2.default.find(function (langItem) {
                            return langItem.English === data.Language;
                        }).alpha2;
                        if ('' == _this3.lang) {
                            _this3.lang = _this3.movieLang;
                        }
                        suc();
                    }
                });
            });
        }
    }, {
        key: 'searchSubtitles',
        value: function searchSubtitles() {
            var _this4 = this;

            return this.api.search({
                imdbid: this.imdbId,
                gzip: true
            }).then(function (subtitles) {
                if (subtitles.hasOwnProperty(_this4.lang)) {
                    _this4.subtitles[_this4.lang] = subtitles[_this4.lang];
                }
                if (subtitles.hasOwnProperty(_this4.movieLang) && !_this4.subtitles.hasOwnProperty(_this4.movieLang)) {
                    _this4.subtitles[_this4.movieLang] = subtitles[_this4.movieLang];
                }
            });
        }
    }, {
        key: 'downloadSubtitles',
        value: function downloadSubtitles() {
            var _this5 = this;

            return (0, _requestPromise2.default)({
                url: this.subtitles[this.lang].url,
                encoding: null,
                resolveWithFullResponse: true
            }).then(function (response) {
                return new Promise(function (suc, rej) {
                    var ext = _path2.default.extname(response.request.href);
                    if ('.gz' === ext) {
                        _zlib2.default.unzip(response.body, function (err, buffer) {
                            if (err) rej(err);
                            suc(buffer);
                        });
                    } else if ('.zip' === ext) {
                        var zip = new _admZip2.default(response.body);
                        var zipEntry = zip.getEntries().shift();
                        suc(zipEntry.getData());
                    } else {
                        throw 'Unsupported file extension: ' + ext + '.';
                    }
                });
            }).then(function (buffer) {
                var encodingData = (0, _detectCharacterEncoding2.default)(buffer);
                var encoding = void 0;
                if (encodingData.confidence < 50 && _this5.subtitles[_this5.lang].hasOwnProperty('encoding')) {
                    encoding = _this5.subtitles[_this5.lang].encoding;
                } else {
                    encoding = encodingData.encoding;
                }
                return buffer.toString(encoding);
            });
        }
    }, {
        key: 'translate',
        value: function translate(data, lang) {
            var _this6 = this;

            var captions = new _subtitle2.default();
            captions.parse(data);
            var subtitles = captions.getSubtitles();
            //subtitles = subtitles.slice(1, 500);
            var yt = new _yandex2.default(process.env['YT.token']);
            var subsToTranslate = [];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                var _loop = function _loop() {
                    var subtitle = _step.value;

                    subsToTranslate.push(function () {
                        return yt.translate(subtitle.text, _this6.lang + '-' + lang, true).then(function (translated) {
                            _this6.emit('translating', subsToTranslate.length);
                            subtitle.text = translated.toString();
                        }).catch(function (err) {
                            //console.log(err);
                        });
                    });
                };

                for (var _iterator = subtitles[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    _loop();
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            this.emit('translate', subsToTranslate.length);
            return (0, _promisePatterns.waterfall)(subsToTranslate).then(function () {
                return captions.stringify();
            }).catch(function (err) {
                //console.log(err)
            });
        }
    }]);

    return SubtitlesManager;
}(_events2.default.EventEmitter);

exports.default = SubtitlesManager;
