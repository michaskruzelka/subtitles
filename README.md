# Subtitles Manager

A tool written in node.js for downloading
and translating subtitles.

## Prerequisites:
1) Make ./bin/download script executable.
```bash
$ chmod +x bin/download
```
2) Init the following environment
variables:
- OS.useragent=[OpenSubtitlesApi useragent]
- OS.username=[OpenSubtitlesApi username]
- OS.password=[OpenSubtitlesApi password]
- YT.token=[YandexTranslate token]

## Usage

```bash
$ ./bin/download <movieTitle|imdbID> [lang] [-t]
```
Arguments:
- Movie title or ImdbID (required).
- Language in ISO 639-1 format or in English (optional):
 'en' or 'English', 'da' or 'Danish' and so on.
- -t (or --translate) option: translates from the original language
  provided the subtitles were not found.

Example:

```bash
$ ./bin/download tt3346410 be -t
```

## License
View the [LICENSE](https://github.com/michaskruzelka/orthographies/blob/master/LICENSE) file
(MIT).