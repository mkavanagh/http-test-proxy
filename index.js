'use strict';

const http = require('http');
const url = require('url');

const command = require('commander');

command.description('Proxy HTTP requests with optional alterations')
    .option('-p, --port [port]', 'listen on the given port')
    .option('--delay [seconds]', 'wait (at least) the given number of seconds before responding')
    .option('--status [code]', 'return the given HTTP status code for all requests')
    .parse(process.argv);

const target = url.parse(command.args[0]);

http.createServer((req, res) => {
        const options = Object.assign({}, target);

        options.method = req.method;
        options.path = url.parse(req.url).path;
        options.headers = Object.assign({}, req.headers);

        const upstream = http.request(options);

        req.on('aborted', upstream.abort);

        req.pipe(upstream);

        upstream.end();

        upstream.on('response', (response) => {
                if (typeof command.status !== 'undefined') {
                    res.statusCode = command.status;
                } else {
                    res.statusCode = response.statusCode;
                }

                Object.keys(response.headers).forEach((header) => {
                    res.setHeader(header, response.headers[header]);
                });

                if (typeof command.delay !== 'undefined') {
                    setTimeout(() => response.pipe(res), 1000 * command.delay);
                } else {
                    response.pipe(res);
                }
            })
            .on('error', () => res.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
    })
    .listen(command.port);
