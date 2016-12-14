#!/usr/bin/env node

'use strict';


const Fs = require('fs');
const _ = require('lodash');
const Cheerio = require('cheerio');
const Async = require('async');
const Request = require('request-promise');
const CookieKit = require('tough-cookie-kit');
const Moment = require('moment');
const Bunyan = require('bunyan');
const Inquirer = require('inquirer');
const Chalk = require('chalk');


const Log = Bunyan.createLogger({
    name: 'weibo-spider',
    src: true
});
// Log.trace, Log.debug, Log.info, Log.warn, Log.error, and Log.fatal


let gCookies = Request.jar(new CookieKit('cookies.json'));
const gRequest = Request.defaults({
    // 'proxy': 'http://8.8.8.8:8888',
    'gzip': true,
    'simple': false, // Get a rejection only if the request failed for technical reasons
    'resolveWithFullResponse': true, // Get the full response instead of just the body
    'followRedirect': false,
    'jar': gCookies
});

let gHeaders = {
    'Host': 'passport.weibo.cn',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, sdch, br',
    'Accept-Language': 'zh-CN,zh;q=0.8'
};


const USER_NAME = '';
const PASS_WORD = '';


main();

function main() {
    return procMain();
}

function procMain() {
    return Async.waterfall([
        function(done) {
            return getLogin().then(function(res) {
                return done(null, res);
            });
        },
        function(data, done) {
            return postLogin(USER_NAME, PASS_WORD).then(function(res) {
                return done(null, res);
            });
        },
        function(data, done) {
            return getMain().then(function(res) {
                return done(null, res);
            });
        },
        function(data, done) {
            return getCommonGroup().then(function(res) {
                return done(null, res);
            });
        },
        function(data, done) {
            return getFeed().then(function(res) {
                return done(null, res);
            });
        },
        function(data, done) {
            return getMBlog().then(function(res) {  // 从这里返回的html里面获取发微博需要的st参数
                return done(null, getStCode(res.body));
            });
        },
        function(data, done) {
            return postAMBlog('send by node.js', data).then(function(res) {
                return done(null, res);
            });
        }
    ], function (err, res) {
        return err ? console.log(Chalk.red(err)) : showBody(res);
    });
}

function showBody(data) {
    console.log(data.body);
}

function getStCode(strHtml) {
    let regexSt = /\"st\":\"(\w+?)\",/i;
    let arrSt = strHtml.match(regexSt);
    return ((arrSt.length !== 2) ? null : arrSt[1]);
}

function getLogin() {
    let headers = _.assign({}, gHeaders, {
        'Upgrade-Insecure-Requests': 1,
        'Referer': 'https://passport.weibo.cn/signin/welcome'
    });

    return getHtml('https://passport.weibo.cn/signin/login?entry=mweibo&res=wel&wm=3349&r=http%3A%2F%2Fm.weibo.cn%2F', headers);
}

function postLogin(username, password) {
    let headers = _.assign({}, gHeaders, {
        'Origin': 'https://passport.weibo.cn',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Referer': 'https://passport.weibo.cn/signin/login?entry=mweibo&res=wel&wm=3349&r=http%3A%2F%2Fm.weibo.cn%2F'
    });

    let form = {
        'username': username,
        'password': password,
        'savestate': 1,
        'ec': 0,
        'pagerefer': 'https://passport.weibo.cn/signin/welcome',
        'entry': 'mweibo',
        'wentry': '',
        'loginfrom': '',
        'client_id': '',
        'code': '',
        'qq': '',
        'hff': '',
        'hfp': ''
    };

    return postForm(`https://passport.weibo.cn/sso/login`, headers, form);
}

function getMain() {
    let headers = _.assign({}, gHeaders, {
        'Upgrade-Insecure-Requests': 1,
        'Referer': 'https://passport.weibo.cn/signin/welcome',
        'Host': 'm.weibo.cn'
    });

    return getHtml('http://m.weibo.cn/', headers);
}

function getCommonGroup() {
    let headers = _.assign({}, gHeaders, {
        'Referer': 'http://m.weibo.cn/',
        'Host': 'm.weibo.cn',
        'X-Requested-With': 'XMLHttpRequest'
    });

    return getJson('http://m.weibo.cn/index/getCommonGroup', headers);
}

function getFeed() {
    let headers = _.assign({}, gHeaders, {
        'Referer': 'http://m.weibo.cn/',
        'Host': 'm.weibo.cn',
        'X-Requested-With': 'XMLHttpRequest'
    });

    let data = {
        'format': 'cards'
    };

    return getJson('http://m.weibo.cn/index/feed', headers, data);
}

function getMBlog() {
    let headers = _.assign({}, gHeaders, {
        'Referer': 'http://m.weibo.cn/',
        'Host': 'm.weibo.cn',
        'Upgrade-Insecure-Requests': 1
    });

    return getHtml('http://m.weibo.cn/mblog', headers);
}

function postAMBlog(content, st) {
    let headers = _.assign({}, gHeaders, {
        'Host': 'm.weibo.cn',
        'Origin': 'http://m.weibo.cn',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'http://m.weibo.cn/mblog',
        'X-Requested-With': 'XMLHttpRequest'
    });

    let form = {
        'content': content,
        'annotations': '',
        'st': st
    };

    return postForm(`http://m.weibo.cn/mblogDeal/addAMblog`, headers, form);
}

function getHtml(url, headers, data) {
    let options = {
        'url': url,
        'headers': headers,
        'qs': data
    };
    return get(options);
}

function getJson(url, headers, data) {
    let options = {
        'url': url,
        'headers': headers,
        'qs': data,
        'json': true
    };
    return get(options);
}

function postJson(url, headers, json) {
    let options = {
        'url': url,
        'headers': headers,
        'form': json,
        'json': true
    };
    return post(options);
}

function postForm(url, headers, form) {
    let options = {
        'url': url,
        'headers': headers,
        'form': form
    };
    return post(options);
}

function get(options) {
    return reqHttp(_.assign({}, options, {
        'method': 'GET'
    }));
}

function post(options) {
    return reqHttp(_.assign({}, options, {
        'method': 'POST'
    }));
}

function reqHttp(options) {
    return gRequest(options)
        .then(procReqSucceeded)
        .catch(procReqFailed);
}

function procReqSucceeded(response) {
    return response;
}

function procReqFailed(error) {
    return Log.error(error);
}

