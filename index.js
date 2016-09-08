'use strict';

const http = require('http');
const url = require('url');

const command = require('commander');

command.description('Proxy HTTP requests with optional alterations')
.option('-p, --port [port]', 'listen on the given port')
.option('--delay [seconds]', 'wait (at least) the given number of seconds before responding')
.option('--status [code]', 'return the given HTTP status code for all requests')
.option('--include [regex]', 'alter only requests where the URL (/path?query) matches the given regex')
.option('--exclude [regex]', 'exclude requests where the URL (/path?query) matches the given regex')
.parse(process.argv);

const target = url.parse(command.args[0]);

const includeUrls = new RegExp(command.include || '.*');
const excludeUrls = new RegExp(command.exclude || '.^');

http.createServer((req, res) => {
    const startTime = process.hrtime();

    const shouldAlter = req.url.match(includeUrls) && !req.url.match(excludeUrls);

    const info = {startTime, url: req.url, shouldAlter};

    console.log('Sending request', info);

    const options = Object.assign({}, target);

    options.method = req.method;
    options.path = url.parse(req.url).path;
    options.headers = Object.assign({}, req.headers);

    const upstream = http.request(options);

    req.on('aborted', upstream.abort);

    req.pipe(upstream);

    upstream.end();

    upstream.on('response', (response) => {
        console.log(`Received response after ${process.hrtime(startTime)[0]} seconds`, info);

        if (typeof command.status !== 'undefined' && shouldAlter) {
            res.statusCode = command.status;
        } else {
            res.statusCode = response.statusCode;
        }

        Object.keys(response.headers).forEach((header) => {
            res.setHeader(header, response.headers[header]);
        });

        const sendResponse = () => {
            console.log(`Sending response after ${process.hrtime(startTime)[0]} seconds`, info);

            response.pipe(res);
        };

        if (typeof command.delay !== 'undefined' && shouldAlter) {
            setTimeout(sendResponse, 1000 * command.delay);
        } else {
            sendResponse();
        }
    }).on('error', () => res.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
}).listen(command.port);
