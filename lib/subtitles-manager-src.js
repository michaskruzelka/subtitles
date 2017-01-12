import events from 'events';
import OS from 'opensubtitles-api';
import yify from 'yifysubtitles-api';
import omdb from 'omdb-client';
import Captions from 'subtitle';
import YT from 'yandex.translate';
import request from 'request-promise';
import {waterfall} from 'promise-patterns';
import path from 'path';
import zlib from 'zlib';
import Zip from 'adm-zip';
import encodingDetector from 'detect-character-encoding';
import languages from './../config/languages.json';

class SubtitlesManager extends events.EventEmitter {

    constructor(search, lang, api = 'yify') {
        super();
        this.initSearch(search);
        this.initLang(lang);
        this.initApi(api);
        this.subtitles = {};
    }

    initSearch(search) {
        const re = new RegExp('^(tt)?(\\d){6,}$', 'i');
        if (re.test(search)) {
            this.imdbId = ('tt' + search).replace('tt'.repeat(2), 'tt');
        } else {
            this.title = search;
        }
    }

    initLang(lang) {
        this.lang = lang;
    }

    initApi(api) {
        if ('os' == api) {
            this.api = new OS({
                useragent: process.env['OS.useragent'],
                username: process.env['OS.username'],
                password: process.env['OS.password']
            });
        } else if ('yify' == api) {
            this.api = yify;
        } else {
            throw 'Unsupported api.';
        }
    }

    reset() {
        this.imdbId = null;
        this.title = null;
        this.movieLang = null;
        this.subtitles = {};
    }

    search(translate = false) {
        return this.searchMovie().then(() => {
            if ( ! this.movieFound) {
                throw 'Movie not found.';
            }
            return this.searchSubtitles();
        }).then(() => {
            if (this.subtitles.hasOwnProperty(this.lang)) {
            return this.downloadSubtitles();
        }
        this.initApi(yify === this.api ? 'os' : 'yify');
        return this.searchSubtitles().then(() => {
            if (this.subtitles.hasOwnProperty(this.lang)) {
                return this.downloadSubtitles();
            }
            if ( ! translate
                || this.lang === this.movieLang
                || ! this.subtitles.hasOwnProperty(this.movieLang)
            ) {
                throw 'Subtitles not found.';
            }
            const lang = this.lang;
            this.lang = this.movieLang;
            return this.downloadSubtitles().then(data => {
                return this.translate(data, lang).then(translatedData => {
                    this.lang = lang;
                    return translatedData;
                });
            }).catch(err => {
                    throw err;
            });
        });
    }).catch(err => {
            return { error: err };
    });
    }

    searchMovie() {
        return new Promise((suc, rej) => {
            this.movieFound = false;
        let params = {};
        if (this.imdbId) {
            params.id = this.imdbId;
        } else {
            params.title = this.title;
        }
        omdb.get(params, (err, data) => {
            if (err) {
            this.movieFound = false;
            rej(err);
        } else {
            this.imdbId = data.imdbID;
            this.title = data.Title;
            this.movieFound = true;
            this.movieLang = languages.find((langItem) => {
                    return langItem.English === data.Language;
        }).alpha2;
            if ('' == this.lang) {
                this.lang = this.movieLang;
            }
            suc();
        }
    });
    });
    }

    searchSubtitles() {
        return this.api.search({
            imdbid: this.imdbId,
            gzip: true
        }).then(subtitles => {
            if (subtitles.hasOwnProperty(this.lang)) {
                this.subtitles[this.lang] = subtitles[this.lang];
            }
            if (subtitles.hasOwnProperty(this.movieLang)
                && ! this.subtitles.hasOwnProperty(this.movieLang)
            ) {
                this.subtitles[this.movieLang] = subtitles[this.movieLang];
            }
        });
    }

    downloadSubtitles() {
        return request({
            url: this.subtitles[this.lang].url,
            encoding: null,
            resolveWithFullResponse: true
        }).then(response => {
            return new Promise((suc, rej) => {
                const ext = path.extname(response.request.href);
                if ('.gz' === ext) {
                    zlib.unzip(response.body, function (err, buffer) {
                        if (err) rej(err);
                        suc(buffer);
                    });
                } else if ('.zip' === ext) {
                    const zip = new Zip(response.body);
                    const zipEntry = zip.getEntries().shift();
                    suc(zipEntry.getData());
                } else {
                    throw `Unsupported file extension: ${ext}.`;
                }
            });
        }).then(buffer => {
                const encodingData = encodingDetector(buffer);
            let encoding;
            if (encodingData.confidence < 50 && this.subtitles[this.lang].hasOwnProperty('encoding')) {
                encoding = this.subtitles[this.lang].encoding;
            } else {
                encoding = encodingData.encoding;
            }
            return buffer.toString(encoding);
        });
    }

    translate(data, lang) {
        const captions = new Captions();
        captions.parse(data);
        let subtitles = captions.getSubtitles();
        //subtitles = subtitles.slice(1, 500);
        const yt = new YT(process.env['YT.token']);
        let subsToTranslate = [];
        for (const subtitle of subtitles) {
            subsToTranslate.push(() => {
                return yt.translate(subtitle.text, `${this.lang}-${lang}`, true)
        .then(translated => {
                this.emit('translating', subsToTranslate.length);
            subtitle.text = translated.toString();
        }).catch(err => {
                //console.log(err);
            });
        });
        }
        this.emit('translate', subsToTranslate.length);
        return waterfall(subsToTranslate).then(() => {
                return captions.stringify();
    }).catch(err => {
            //console.log(err)
        });
    }
}

export default SubtitlesManager;